import _ from "lodash";
import { listAllCurrencyRates } from "../../../configuration";
import { sendHttpTextRequest } from "../../utils/http";
import { StockBroker } from "./stock-broker";

export type IbkrFlexPosition = {
  symbol: string;
  amount: number;
  price: number;
  currency: string;
};

type IbkrBrokerOptions = {
  statementPollDelayMs?: number;
  maxStatementPollAttempts?: number;
};

const flexEndpoint =
  "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest";
const getStatementEndpoint =
  "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement";
const defaultStatementPollDelayMs = 1000;
const defaultMaxStatementPollAttempts = 6;

export function parseIbkrFlexOpenPositions(xml: string): IbkrFlexPosition[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const positions = Array.from(doc.getElementsByTagName("OpenPosition"));

  return _(positions)
    .map((position) => {
      const assetCategory =
        position.getAttribute("assetCategory") ??
        position.getAttribute("assetClass") ??
        "";
      if (assetCategory.toUpperCase() !== "STK") {
        return;
      }

      const symbol = position.getAttribute("symbol")?.trim().toUpperCase();
      const amount = parseFloat(
        position.getAttribute("position") ??
          position.getAttribute("quantity") ??
          "0",
      );
      const price = parseFloat(
        position.getAttribute("markPrice") ??
          position.getAttribute("price") ??
          "0",
      );
      const currency = (
        position.getAttribute("currency") ??
        position.getAttribute("currencyPrimary") ??
        "USD"
      )
        .trim()
        .toUpperCase();
      if (!symbol || !amount) {
        return;
      }

      return {
        symbol,
        amount,
        price: Number.isFinite(price) ? price : 0,
        currency: currency || "USD",
      };
    })
    .compact()
    .value();
}

function firstTagText(doc: Document, tagName: string): string | undefined {
  return doc.getElementsByTagName(tagName)[0]?.textContent?.trim();
}

export function getIbkrFlexStatementUrl(xml: string, token: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");

  const statementUrl = firstTagText(doc, "Url");
  if (statementUrl) {
    return statementUrl;
  }

  const referenceCode = firstTagText(doc, "ReferenceCode");
  if (referenceCode) {
    return `${getStatementEndpoint}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(referenceCode)}&v=3`;
  }

  throw new Error("IBKR Flex response did not include a statement URL");
}

function isFlexReportXml(xml: string): boolean {
  return (
    xml.includes("<FlexQueryResponse") ||
    xml.includes("<FlexStatements") ||
    xml.includes("<OpenPositions") ||
    xml.includes("<OpenPosition")
  );
}

function getFlexResponseError(xml: string):
  | {
      status?: string;
      errorCode?: string;
      errorMessage?: string;
    }
  | undefined {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const status = firstTagText(doc, "Status");
  const errorCode = firstTagText(doc, "ErrorCode");
  const errorMessage = firstTagText(doc, "ErrorMessage");

  if (!status && !errorCode && !errorMessage) {
    return;
  }

  return {
    status,
    errorCode,
    errorMessage,
  };
}

function isFlexStatementPending(xml: string): boolean {
  const err = getFlexResponseError(xml);
  if (!err) {
    return false;
  }

  const message = err.errorMessage?.toLowerCase() ?? "";
  return (
    err.errorCode === "1019" ||
    message.includes("generation in progress") ||
    message.includes("please try again")
  );
}

function assertSuccessfulFlexResponse(xml: string) {
  const err = getFlexResponseError(xml);
  if (!err?.status || err.status.toLowerCase() === "success") {
    return;
  }

  const detail = [err.status, err.errorCode, err.errorMessage]
    .filter(Boolean)
    .join(": ");
  throw new Error(`IBKR Flex request failed: ${detail}`);
}

function wait(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class IbkrBroker implements StockBroker {
  private readonly token: string;
  private readonly queryId: string;
  private readonly alias?: string;
  private readonly statementPollDelayMs: number;
  private readonly maxStatementPollAttempts: number;
  private flexXml?: string;

  constructor(
    token: string,
    queryId: string,
    alias?: string,
    options: IbkrBrokerOptions = {},
  ) {
    this.token = token;
    this.queryId = queryId;
    this.alias = alias;
    this.statementPollDelayMs =
      options.statementPollDelayMs ?? defaultStatementPollDelayMs;
    this.maxStatementPollAttempts =
      options.maxStatementPollAttempts ?? defaultMaxStatementPollAttempts;
  }

  getBrokerName(): string {
    return "ibkr";
  }

  getIdentity(): string {
    return `ibkr:${this.queryId}`;
  }

  getAlias(): string | undefined {
    return this.alias;
  }

  async fetchPositions(): Promise<{ [symbol: string]: number }> {
    const positions = parseIbkrFlexOpenPositions(await this.fetchFlexXml());
    return _(positions).mapKeys("symbol").mapValues("amount").value();
  }

  async fetchPositionsPrice(): Promise<{ [symbol: string]: number }> {
    const positions = parseIbkrFlexOpenPositions(await this.fetchFlexXml());
    const priceBySymbol = await this.convertPositionPricesToUsd(positions);
    return _(priceBySymbol).mapKeys("symbol").mapValues("price").value();
  }

  async verifyConfig(): Promise<boolean> {
    return !!this.token.trim() && !!this.queryId.trim();
  }

  private async fetchFlexXml(): Promise<string> {
    if (this.flexXml) {
      return this.flexXml;
    }

    const requestUrl = `${flexEndpoint}?t=${encodeURIComponent(this.token)}&q=${encodeURIComponent(this.queryId)}&v=3`;
    const responseXml = await sendHttpTextRequest("GET", requestUrl, 20000);
    if (isFlexReportXml(responseXml)) {
      this.flexXml = responseXml;
      return responseXml;
    }
    assertSuccessfulFlexResponse(responseXml);

    const statementUrl = getIbkrFlexStatementUrl(responseXml, this.token);

    for (let attempt = 1; attempt <= this.maxStatementPollAttempts; attempt++) {
      const statementXml = await sendHttpTextRequest("GET", statementUrl, 30000);
      if (isFlexReportXml(statementXml)) {
        this.flexXml = statementXml;
        return statementXml;
      }

      if (!isFlexStatementPending(statementXml)) {
        assertSuccessfulFlexResponse(statementXml);
        throw new Error("IBKR Flex statement response did not include a report");
      }

      if (attempt < this.maxStatementPollAttempts) {
        await wait(this.getStatementPollDelay(attempt));
      }
    }

    throw new Error("IBKR Flex statement was not ready before polling timed out");
  }

  private getStatementPollDelay(attempt: number): number {
    if (this.statementPollDelayMs <= 0) {
      return 0;
    }
    return Math.min(
      this.statementPollDelayMs * 2 ** Math.max(attempt - 1, 0),
      10000,
    );
  }

  private async convertPositionPricesToUsd(
    positions: IbkrFlexPosition[],
  ): Promise<IbkrFlexPosition[]> {
    const nonUsdCurrencies = _(positions)
      .map((position) => position.currency)
      .filter((currency) => currency !== "USD")
      .uniq()
      .value();

    if (nonUsdCurrencies.length === 0) {
      return positions;
    }

    const rateMap = _(await listAllCurrencyRates())
      .keyBy((rate) => rate.currency.toUpperCase())
      .mapValues("rate")
      .value();
    rateMap.USD = 1;

    return positions.map((position) => {
      const rate = rateMap[position.currency];
      if (!rate || rate <= 0) {
        throw new Error(`Missing currency rate for ${position.currency}`);
      }
      return {
        ...position,
        price: position.price / rate,
      };
    });
  }
}
