import { listAllCurrencyRates } from "../../../configuration";
import { sendHttpTextRequest } from "../../utils/http";
import { StockBroker, applyMarketSuffix } from "./stock-broker";
import { redactSecrets } from "../../../security/redact";
import type { WalletCoin } from "../../types";
import { recordOptionalSourceFailure } from "../../utils/source-failure";
import { SourceStatusError } from "../../utils/source-failure";
import { fetchStockPrices } from "../../utils/price";
import { getVersion } from "../../../../utils/app";
import md5 from "md5";

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
const requestTimes = new Map<string, { times: number[]; tail: Promise<void> }>();

async function limitFlexRequest(token: string): Promise<void> {
  const key = md5(token);
  let state = requestTimes.get(key);
  if (!state) {
    state = { times: [], tail: Promise.resolve() };
    requestTimes.set(key, state);
  }
  const current = state;
  const turn = current.tail.then(async () => {
    const now = Date.now();
    current.times = current.times.filter((time) => time > now - 60_000);
    const latest = current.times.at(-1);
    const delay = Math.max(0, latest === undefined ? 0 : latest + 1000 - now,
      current.times.length >= 10 ? current.times[0] + 60_000 - now : 0);
    await wait(delay);
    current.times.push(Date.now());
  });
  current.tail = turn;
  await turn;
}

function firstTagText(
  scope: Document | Element,
  tagName: string,
): string | undefined {
  return scope.getElementsByTagName(tagName)[0]?.textContent?.trim();
}

function parseIbkrFlexCashPositions(doc: Document): IbkrFlexPosition[] {
  const totals = new Map<string, number>();
  for (const statement of Array.from(doc.getElementsByTagName("FlexStatement"))) {
    const rows = Array.from(statement.getElementsByTagName("CashReportCurrency"));
    const breakout = rows.filter((row) => row.getAttribute("currency") !== "BASE_SUMMARY");
    const base = statement.getElementsByTagName("AccountInformation")[0]?.getAttribute("currency")?.trim().toUpperCase();
    for (const row of breakout.length ? breakout : rows) {
      const currency = breakout.length
        ? row.getAttribute("currency")?.trim().toUpperCase()
        : base;
      const amount = Number(row.getAttribute("endingCash"));
      if (!currency || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(amount)) continue;
      totals.set(currency, (totals.get(currency) ?? 0) + amount);
    }
  }
  return Array.from(totals, ([currency, amount]) => ({
    symbol: currency, amount, price: 1,
    currency, market: "",
  })).filter((position) => position.amount !== 0);
}

type ParsedIbkrPosition = IbkrFlexPosition & { kind: "stock" | "crypto" | "fund" | "cash" };
const supportedCryptoSymbols = new Set(["BTC", "ETH", "LTC", "BCH"]);
const isCurrencyCode = (value: string | null | undefined): value is string =>
  !!value && /^[A-Z]{3}$/.test(value);

function parseIbkrFlexReport(xml: string): {
  positions: ParsedIbkrPosition[];
  cashMissing: boolean;
  excluded: Record<string, number>;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const excluded: Record<string, number> = {};
  const positions = Array.from(doc.getElementsByTagName("OpenPosition"))
    .map((position) => {
      const assetCategory = (
        position.getAttribute("assetCategory") ??
        position.getAttribute("assetClass") ??
        ""
      ).toUpperCase();
      const rawSymbol = position.getAttribute("symbol")?.trim().toUpperCase();
      const amount = Number(
        position.getAttribute("position") ??
          position.getAttribute("quantity") ??
          "0",
      );
      if (!Number.isFinite(amount) || !amount) {
        return;
      }
      if (assetCategory !== "STK" && assetCategory !== "CRYPTO" && assetCategory !== "FUND") {
        const category = /^[A-Z]{1,16}$/.test(assetCategory) ? assetCategory : "OTHER";
        excluded[category] = (excluded[category] ?? 0) + 1;
        return;
      }
      if (!rawSymbol || (assetCategory === "CRYPTO" && !supportedCryptoSymbols.has(rawSymbol))) {
        excluded[assetCategory || "OTHER"] = (excluded[assetCategory || "OTHER"] ?? 0) + 1;
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
        symbol: rawSymbol,
        amount,
        price: 0,
        currency: currency || "USD",
        market,
        kind: assetCategory === "CRYPTO" ? "crypto" : assetCategory === "FUND" ? "fund" : "stock",
      };
    })
    .filter((p): p is ParsedIbkrPosition => p !== undefined);
  const cashMissing = Array.from(doc.getElementsByTagName("FlexStatement")).some((statement) => {
    const rows = Array.from(statement.getElementsByTagName("CashReportCurrency"));
    const breakout = rows.filter((row) => row.getAttribute("currency") !== "BASE_SUMMARY");
    if (breakout.length) {
      return breakout.some((row) => !isCurrencyCode(row.getAttribute("currency")?.trim().toUpperCase()) ||
        !Number.isFinite(Number(row.getAttribute("endingCash"))));
    }
    const base = statement.getElementsByTagName("AccountInformation")[0]?.getAttribute("currency")?.trim().toUpperCase();
    return rows.some((row) => row.getAttribute("currency") === "BASE_SUMMARY" &&
      Number(row.getAttribute("endingCash")) !== 0) && !isCurrencyCode(base);
  });
  return {
    positions: [...positions, ...parseIbkrFlexCashPositions(doc).map((position): ParsedIbkrPosition => ({
      ...position, kind: "cash",
    }))],
    cashMissing,
    excluded,
  };
}

export function parseIbkrFlexOpenPositions(xml: string): IbkrFlexPosition[] {
  return parseIbkrFlexReport(xml).positions.map(({ kind: _kind, ...position }) => position);
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
  return err?.errorCode === "1019";
}

const flexErrorDetails: Record<string, { category: "auth" | "service"; detail: string }> = {
  "1010": { category: "auth", detail: "IBKR invalid query" },
  "1011": { category: "auth", detail: "IBKR no permission" },
  "1012": { category: "auth", detail: "IBKR token expired" },
  "1013": { category: "auth", detail: "IBKR IP restricted" },
  "1014": { category: "auth", detail: "IBKR invalid query" },
  "1015": { category: "auth", detail: "IBKR invalid token" },
  "1016": { category: "auth", detail: "IBKR no permission" },
  "1017": { category: "service", detail: "IBKR not ready" },
};
const notReadyCodes = new Set(["1001", "1003", "1004", "1005", "1006", "1007", "1008", "1009", "1019", "1021"]);

function assertSuccessfulFlexResponse(xml: string, token: string) {
  const err = getFlexResponseError(xml);
  if (!err || (err.status?.toLowerCase() === "success" && !err.errorCode) ||
    (!err.status && !err.errorCode)) {
    return;
  }
  if (err.errorCode && /^\d{4}$/.test(err.errorCode)) {
    console.warn("IBKR Flex error code", redactSecrets(err.errorCode, [token]));
  }
  if (err.errorCode === "1018") throw new SourceStatusError("rateLimit", "IBKR rate limited");
  const mapped = err.errorCode && flexErrorDetails[err.errorCode];
  if (mapped) throw new SourceStatusError(mapped.category, mapped.detail);
  if (err.errorCode && notReadyCodes.has(err.errorCode)) {
    throw new SourceStatusError("service", "IBKR not ready");
  }
  const detail = [err.status, err.errorCode, err.errorMessage]
    .filter(Boolean)
    .join(": ");
  throw new Error(`IBKR Flex request failed: ${redactSecrets(detail, [token])}`);
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
    return "IBKR";
  }

  getIdentity(): string {
    return `ibkr:${this.queryId}`;
  }

  getAlias(): string | undefined {
    return this.alias;
  }

  async loadPortfolio(): Promise<WalletCoin[]> {
    const report = parseIbkrFlexReport(await this.fetchFlexXml());
    if (report.cashMissing) {
      recordOptionalSourceFailure(this, new Error("IBKR cash not included"), "IBKR cash");
    }
    const fundSymbols = report.positions.filter((position) => position.kind === "fund")
      .map((position) => applyMarketSuffix(position.symbol, position.market, position.currency));
    const fundPrices = fundSymbols.length
      ? await fetchStockPrices(fundSymbols).catch(() => ({} as Record<string, number>)) : {};
    const cashCurrencies = report.positions.filter((position) => position.kind === "cash" && position.currency !== "USD");
    const rates = cashCurrencies.length ? await listAllCurrencyRates().catch(() => []) : [];
    const rateMap = Object.fromEntries(rates.map((rate) => [rate.currency.toUpperCase(), rate.rate]));
    const securitySymbols = new Set(report.positions
      .filter((position) => position.kind === "stock" || position.kind === "fund")
      .map((position) => applyMarketSuffix(position.symbol, position.market, position.currency)));
    const coins: WalletCoin[] = [];
    for (const position of report.positions) {
      if (position.kind === "cash" && securitySymbols.has(position.symbol)) {
        recordOptionalSourceFailure(this, new Error("IBKR cash conflicts with security ticker"), "IBKR cash");
        continue;
      }
      const symbol = position.kind === "stock" || position.kind === "fund"
        ? applyMarketSuffix(position.symbol, position.market, position.currency) : position.symbol;
      if (position.kind === "fund" && !(Number.isFinite(fundPrices[symbol]) && fundPrices[symbol] > 0)) {
        report.excluded.FUND = (report.excluded.FUND ?? 0) + 1;
        continue;
      }
      if (position.kind === "cash" && position.currency !== "USD" &&
        !(Number.isFinite(rateMap[position.currency]) && rateMap[position.currency] > 0)) {
        recordOptionalSourceFailure(this, new Error("IBKR cash rate unavailable"), "IBKR cash rate");
        continue;
      }
      coins.push({
        symbol,
        assetType: position.kind === "crypto" ? "crypto" : "stock",
        amount: position.amount,
        wallet: this.getIdentity(),
        ...(position.kind === "fund" ? { price: {
          base: "usd" as const, value: fundPrices[symbol],
        } } : {}),
        ...(position.kind === "cash" ? { price: {
          base: "usd" as const,
          value: position.currency === "USD" ? 1 : 1 / rateMap[position.currency],
        } } : {}),
      });
    }
    const counts = Object.entries(report.excluded)
      .sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b));
    if (counts.length) {
      recordOptionalSourceFailure(this, new Error("IBKR positions not included"),
        `IBKR positions: ${counts.map(([category, count]) => `${category} x${count}`).join(", ")}`);
    }
    return coins;
  }

  async fetchPositions(): Promise<{ [symbol: string]: number }> {
    const positions = await this.loadPortfolio();
    return positions.reduce<Record<string, number>>((totals, position) => {
      totals[position.symbol] = (totals[position.symbol] ?? 0) + position.amount;
      return totals;
    }, {});
  }

  async fetchPositionsPrice(): Promise<{ [symbol: string]: number }> {
    return Object.fromEntries((await this.loadPortfolio()).map((position) => [
      position.symbol, position.price?.value ?? 0,
    ]));
  }

  async verifyConfig(): Promise<boolean> {
    return !!this.token.trim() && !!this.queryId.trim();
  }

  private async requestFlex(url: string, timeout: number): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      await limitFlexRequest(this.token);
      const xml = await sendHttpTextRequest("GET", url, timeout, {
        "User-Agent": `Track3/${await getVersion()}`,
      });
      if (getFlexResponseError(xml)?.errorCode !== "1018") return xml;
      console.warn("IBKR Flex error code", redactSecrets("1018", [this.token]));
      if (attempt === 0) await wait(60_000);
      else assertSuccessfulFlexResponse(xml, this.token);
    }
    throw new SourceStatusError("rateLimit", "IBKR rate limited");
  }

  private async fetchFlexXml(): Promise<string> {
    if (this.flexXml) {
      return this.flexXml;
    }

    const requestUrl = `${sendRequestEndpoint}?t=${encodeURIComponent(this.token)}&q=${encodeURIComponent(this.queryId)}&v=3`;

    const sendXml = await this.requestFlex(requestUrl, 20000);
    if (isFlexReportXml(sendXml)) {
      this.flexXml = sendXml;
      return sendXml;
    }
    assertSuccessfulFlexResponse(sendXml, this.token);

    const pollUrl = getIbkrFlexStatementUrl(sendXml, this.token);

    await wait(this.initialStatementDelayMs);

    for (let attempt = 1; attempt <= this.maxStatementPollAttempts; attempt++) {
      console.debug(`IBKR Flex statement poll attempt ${attempt}`, {
        attempt,
      });
      const statementXml = await this.requestFlex(pollUrl, 30000);
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

      assertSuccessfulFlexResponse(statementXml, this.token);
      throw new Error("IBKR Flex statement response did not include a report");
    }

    throw new SourceStatusError("service", "IBKR not ready");
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

}
