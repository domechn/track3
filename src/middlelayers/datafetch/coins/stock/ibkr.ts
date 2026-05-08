import _ from "lodash";
import { listAllCurrencyRates } from "../../../configuration";
import { sendHttpTextRequest } from "../../utils/http";
import { StockBroker, applyMarketSuffix } from "./stock-broker";

export type IbkrFlexPosition = {
  symbol: string;
  amount: number;
  price: number;
  currency: string;
  /** Raw IBKR listingExchange / exchange value, e.g. "SEHK", "NYSE". */
  market: string;
};

type IbkrBrokerOptions = {
  statementPollDelayMs?: number;
  maxStatementPollAttempts?: number;
  initialStatementDelayMs?: number;
};

const flexServiceEndpoint =
  "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService";
const sendRequestEndpoint = `${flexServiceEndpoint}/SendRequest`;
const getStatementEndpoint = `${flexServiceEndpoint}/GetStatement`;
const defaultStatementPollDelayMs = 1000;
const defaultMaxStatementPollAttempts = 6;
const defaultInitialStatementDelayMs = 5000;

function firstTagText(
  scope: Document | Element,
  tagName: string,
): string | undefined {
  return scope.getElementsByTagName(tagName)[0]?.textContent?.trim();
}

function parseIbkrFlexCashPosition(
  doc: Document,
): IbkrFlexPosition | undefined {
  const totalStartingCash = _(
    Array.from(doc.getElementsByTagName("CashReportCurrency")),
  )
    .filter(
      (reportCurrency) =>
        reportCurrency.getAttribute("currency") === "BASE_SUMMARY",
    )
    .map((reportCurrency) =>
      parseFloat(reportCurrency.getAttribute("startingCash") ?? "NaN"),
    )
    .filter((value) => Number.isFinite(value) && value !== 0)
    .sum();

  if (!Number.isFinite(totalStartingCash) || totalStartingCash === 0) {
    return;
  }

  return {
    symbol: "USD",
    amount: totalStartingCash,
    price: 1,
    currency: "USD",
    market: "",
  };
}

export function parseIbkrFlexOpenPositions(xml: string): IbkrFlexPosition[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const stockPositions = _(Array.from(doc.getElementsByTagName("OpenPosition")))
    .map((position) => {
      const assetCategory = (
        position.getAttribute("assetCategory") ??
        position.getAttribute("assetClass") ??
        ""
      ).toUpperCase();
      if (assetCategory !== "STK") {
        return;
      }

      const symbol = position.getAttribute("symbol")?.trim().toUpperCase();
      const amount = parseFloat(
        position.getAttribute("position") ??
          position.getAttribute("quantity") ??
          "0",
      );
      const rawPrice = parseFloat(
        position.getAttribute("markPrice") ??
          position.getAttribute("price") ??
          "0",
      );
      if (!symbol || !amount) {
        return;
      }

      const currency = (
        position.getAttribute("currency") ??
        position.getAttribute("currencyPrimary") ??
        "USD"
      )
        .trim()
        .toUpperCase();
      const market = (
        position.getAttribute("listingExchange") ??
        position.getAttribute("exchange") ??
        ""
      ).trim();

      return {
        symbol,
        amount,
        price: Number.isFinite(rawPrice) ? rawPrice : 0,
        currency: currency || "USD",
        market,
      };
    })
    .compact()
    .value();
  const cashPosition = parseIbkrFlexCashPosition(doc);
  console.log("Parsed IBKR Flex positions", cashPosition);

  return cashPosition ? [...stockPositions, cashPosition] : stockPositions;
}

export function getIbkrFlexStatementUrl(xml: string, token: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");

  const referenceCode = firstTagText(doc, "ReferenceCode");
  if (referenceCode) {
    return `${getStatementEndpoint}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(referenceCode)}&v=3`;
  }

  throw new Error("IBKR Flex response did not include a reference code");
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

  const pendingCodes = new Set([
    "1001",
    "1004",
    "1005",
    "1006",
    "1007",
    "1008",
    "1009",
    "1018",
    "1019",
    "1021",
  ]);
  const message = err.errorMessage?.toLowerCase() ?? "";
  return (
    (err.errorCode != null && pendingCodes.has(err.errorCode)) ||
    message.includes("generation in progress") ||
    message.includes("please try again") ||
    message.includes("being generated") ||
    message.includes("please wait")
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
  private readonly initialStatementDelayMs: number;
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
    this.initialStatementDelayMs =
      options.initialStatementDelayMs ?? defaultInitialStatementDelayMs;
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
    return _(positions)
      .mapKeys((pos) => applyMarketSuffix(pos.symbol, pos.market, pos.currency))
      .mapValues("amount")
      .value();
  }

  async fetchPositionsPrice(): Promise<{ [symbol: string]: number }> {
    const positions = parseIbkrFlexOpenPositions(await this.fetchFlexXml());
    const priceBySymbol = await this.convertPositionPricesToUsd(positions);
    return _(priceBySymbol)
      .mapKeys((pos) => applyMarketSuffix(pos.symbol, pos.market, pos.currency))
      .mapValues("price")
      .value();
  }

  async verifyConfig(): Promise<boolean> {
    return !!this.token.trim() && !!this.queryId.trim();
  }

  private async fetchFlexXml(): Promise<string> {
    if (this.flexXml) {
      return this.flexXml;
    }

    const requestUrl = `${sendRequestEndpoint}?t=${encodeURIComponent(this.token)}&q=${encodeURIComponent(this.queryId)}&v=3`;

    const sendXml = await sendHttpTextRequest("GET", requestUrl, 20000);
    if (isFlexReportXml(sendXml)) {
      this.flexXml = sendXml;
      return sendXml;
    }
    assertSuccessfulFlexResponse(sendXml);

    const pollUrl = getIbkrFlexStatementUrl(sendXml, this.token);

    await wait(this.initialStatementDelayMs);

    for (let attempt = 1; attempt <= this.maxStatementPollAttempts; attempt++) {
      console.debug(`IBKR Flex statement poll attempt ${attempt}`, {
        attempt,
      });
      const statementXml = await sendHttpTextRequest("GET", pollUrl, 30000);
      if (isFlexReportXml(statementXml)) {
        this.flexXml = statementXml;
        return statementXml;
      }

      if (isFlexStatementPending(statementXml)) {
        if (attempt < this.maxStatementPollAttempts) {
          await wait(this.getStatementPollDelay(attempt));
        }
        continue;
      }

      assertSuccessfulFlexResponse(statementXml);
      throw new Error("IBKR Flex statement response did not include a report");
    }

    throw new Error(
      "IBKR Flex statement was not ready before polling timed out",
    );
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
