import _ from "lodash";
import { sendHttpTextRequest } from "../../utils/http";
import { StockBroker } from "./stock-broker";

export type IbkrFlexPosition = {
  symbol: string;
  amount: number;
  price: number;
};

const flexEndpoint =
  "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest";

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
      if (!symbol || !amount) {
        return;
      }

      return {
        symbol,
        amount,
        price: Number.isFinite(price) ? price : 0,
      };
    })
    .compact()
    .value();
}

function firstTagText(doc: Document, tagName: string): string | undefined {
  return doc.getElementsByTagName(tagName)[0]?.textContent?.trim();
}

export class IbkrBroker implements StockBroker {
  private readonly token: string;
  private readonly queryId: string;
  private readonly alias?: string;
  private flexXml?: string;

  constructor(token: string, queryId: string, alias?: string) {
    this.token = token;
    this.queryId = queryId;
    this.alias = alias;
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
    return _(positions).mapKeys("symbol").mapValues("price").value();
  }

  async verifyConfig(): Promise<boolean> {
    if (!this.token || !this.queryId) {
      return false;
    }
    await this.fetchFlexXml();
    return true;
  }

  private async fetchFlexXml(): Promise<string> {
    if (this.flexXml) {
      return this.flexXml;
    }

    const requestUrl = `${flexEndpoint}?t=${encodeURIComponent(this.token)}&q=${encodeURIComponent(this.queryId)}&v=3`;
    const responseXml = await sendHttpTextRequest("GET", requestUrl, 20000);
    if (
      responseXml.includes("<OpenPositions") ||
      responseXml.includes("<OpenPosition")
    ) {
      this.flexXml = responseXml;
      return responseXml;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(responseXml, "text/xml");
    const status = firstTagText(doc, "Status");
    if (status && status.toLowerCase() !== "success") {
      throw new Error(`IBKR Flex request failed: ${status}`);
    }

    const statementUrl = firstTagText(doc, "Url");
    if (!statementUrl) {
      throw new Error("IBKR Flex response did not include a statement URL");
    }

    this.flexXml = await sendHttpTextRequest("GET", statementUrl, 30000);
    return this.flexXml;
  }
}
