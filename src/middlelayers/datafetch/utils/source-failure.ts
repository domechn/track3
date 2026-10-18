import type { PartialSourceFailure, SourceErrorCategory } from "../../portfolio-baseline";

const safeMessages: Record<SourceErrorCategory, string> = {
  auth: "Authentication or invalid key",
  network: "Network or timeout",
  rateLimit: "Rate limit",
  unsupported: "Unsupported source",
  other: "Source provider failed",
};

export class SanitizedSourceError extends Error {
  readonly category: SourceErrorCategory;

  constructor(cause: unknown) {
    const category = classifySourceError(cause);
    super(safeMessages[category]);
    this.category = category;
  }
}

export function classifySourceError(error: unknown): SourceErrorCategory {
  if (error instanceof SanitizedSourceError) return error.category;
  const status = (error as { status?: number })?.status;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 429) return "rateLimit";
  if (status === 401 || status === 403) return "auth";
  if (status === 408 || (status && status >= 500)) return "network";
  const detail = message.replace(/https?:\/\/[^\s)]+/gi, "");
  if (/rate.?limit|too many requests/i.test(detail)) return "rateLimit";
  if (/unauthoriz|forbidden|invalid.?key|invalid.?token|signature|credential|passphrase|password/i.test(detail)) return "auth";
  if (/unsupported|unknown exchange|unknown broker|not implemented/i.test(message)) return "unsupported";
  if (/request failed|request timed out|timeout|timed out|network|connect|offline|unavailable|fetch failed/i.test(detail)) return "network";
  return "other";
}

// Optional provider calls may return partial holdings. Keep their most
// actionable error until the owning source finishes.
const failures = new WeakMap<object, { error: unknown; priority: number }>();
const optionalFailures = new WeakMap<object, PartialSourceFailure>();
export const partialEndpointKeys: Record<string, string> = {
  Earn: "earn", "Fixed-term Earn": "fixedTermEarn", Staking: "staking",
  "Dual investment": "dualInvestment", Portfolio: "portfolio", Margin: "margin",
  "Wallet total": "walletTotal", Futures: "futures", "Cross margin": "crossMargin",
  "Isolated margin": "isolatedMargin", "USDT isolated swap": "usdtIsolatedSwap",
  "USDT cross swap": "usdtCrossSwap", "Coin swap": "coinSwap",
  "Flexible saving": "flexibleSaving", "On-chain Earn": "onChainEarn",
  "Advanced Earn": "advancedEarn", Savings: "savings", Funding: "funding",
  "ETH staking": "ethStaking", "DeFi staking": "defiStaking", Lending: "lending",
  "Solana Earn": "solanaEarn", "SUI DeFi": "suiDefi",
  "Portfolio INTX": "portfolioIntx", "Some assets": "assets",
};

export function safePartialEndpoint(label: string): string | undefined {
  if (/^Portfolio [A-Z_]+$/.test(label)) return label === "Portfolio DEFAULT" ? undefined : label;
  return Object.keys(partialEndpointKeys).find((name) => name.toLowerCase() === label.toLowerCase());
}
const priority: Record<SourceErrorCategory, number> = {
  rateLimit: 4,
  auth: 3,
  network: 2,
  unsupported: 1,
  other: 0,
};

export function recordSourceFailure(source: object, error: unknown): void {
  const nextPriority = priority[classifySourceError(error)];
  if (!failures.has(source) || nextPriority > failures.get(source)!.priority) {
    failures.set(source, {
      error: new SanitizedSourceError(error ?? new Error("Source provider failed")),
      priority: nextPriority,
    });
  }
}

export function recordOptionalSourceFailure(source: object, error: unknown, label: string, includeAuth = false): void {
  const endpoint = safePartialEndpoint(label);
  if (!endpoint) return;
  const status = (error as { status?: number })?.status;
  const reportAuth = includeAuth && (status === 401 || status === 403);
  if ((status === 401 || status === 403) && !reportAuth) return;
  const message = error instanceof Error ? error.message : String(error);
  const detail = message.replace(/https?:\/\/[^\s)]+/gi, "");
  if (!reportAuth &&
    /\b(?:code\s*700011|not (?:enabled|opened|activated|allowed|supported)|permission denied|no (?:margin|futures|earn|portfolio) account)\b/i.test(detail)) return;
  const category = classifySourceError(error);
  const current = optionalFailures.get(source);
  if (!current) {
    optionalFailures.set(source, { category, endpoints: [endpoint] });
  } else {
    if (priority[category] > priority[current.category]) current.category = category;
    if (!current.endpoints.includes(endpoint)) current.endpoints.push(endpoint);
  }
}

export function takeOptionalSourceFailures(source: object): PartialSourceFailure | undefined {
  const partial = optionalFailures.get(source);
  optionalFailures.delete(source);
  return partial;
}

export function transferOptionalSourceFailures(from: object, to: object): boolean {
  const partial = takeOptionalSourceFailures(from);
  if (!partial) return false;
  const current = optionalFailures.get(to);
  if (!current) optionalFailures.set(to, partial);
  else {
    if (priority[partial.category] > priority[current.category]) current.category = partial.category;
    for (const endpoint of partial.endpoints) {
      if (!current.endpoints.includes(endpoint)) current.endpoints.push(endpoint);
    }
  }
  return true;
}

export function takeSourceFailure(source: object): Error | undefined {
  const error = failures.get(source)?.error;
  failures.delete(source);
  return error === undefined ? undefined : new SanitizedSourceError(error);
}
