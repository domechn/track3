import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { beforeEach, expect, it, vi } from "vitest";
import { externalLinks, openExternal } from "./external-links";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "@/components/ui/use-toast";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(openUrl).mockResolvedValue(undefined);
});

it("shows an error toast when a published link cannot be opened", async () => {
  vi.mocked(openUrl).mockRejectedValueOnce(new Error("opener unavailable"));
  await openExternal("docs");
  expect(openUrl).toHaveBeenCalledWith("https://track3.dev/docs/");
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({
    description: "Could not open the link",
    variant: "destructive",
  }));
});

it("allows only central navigation URLs and known data provider URLs in source literals", () => {
  const providerHosts = new Set([
    "api.openai.com", "api.track3.dev", "currency-rate-api.track3.dev",
    "api.ipify.org", "1.1.1.1", "eu.aptabase.com", "us.aptabase.com",
    "blockchain.info", "api.blockcypher.com", "api.backpack.exchange",
    "api.binance.com", "fapi.binance.com", "dapi.binance.com",
    "api.bitget.com", "api.bybit.com", "api.coinbase.com",
    "api.gateio.ws", "api.kraken.com", "api.mexc.com", "www.okx.com",
    "ethereum-rpc.publicnode.com", "bsc-dataseed.bnbchain.org",
    "lite-api.jup.ag", "ndcdyn.interactivebrokers.com",
    "api.getnimbus.io", "toncenter.com",
  ]);
  const ownedHosts = new Set(Object.values(externalLinks).map((value) => new URL(value).hostname));
  const failures: string[] = [];
  const root = resolve("src");

  function visitDir(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (file !== join(root, "test")) visitDir(file);
      } else if (/\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && file !== join(root, "lib", "external-links.ts")) {
        const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
        function visit(node: ts.Node) {
          if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
            const literal = node.text;
            const location = relative(".", file);
            if (/^https:\/\/[^/\s]+/.test(literal)) {
              const host = new URL(literal).hostname;
              if (!providerHosts.has(host)) failures.push(`${location}: ${literal}`);
            }
            for (const host of literal.match(/(?:[\w-]+\.)*track3\.(?:dev|app|io)\b/g) ?? []) {
              if (!ownedHosts.has(host) && !providerHosts.has(host)) failures.push(`${location}: ${host}`);
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
  }
  visitDir(root);
  expect(failures).toEqual([]);
});

it("keeps central URLs well formed and verifies owned pages on demand", async () => {
  for (const value of Object.values(externalLinks)) {
    const url = new URL(value);
    expect(url.protocol).toBe("https:");
    expect(url.username).toBe("");
    expect(url.password).toBe("");
    if (process.env.CHECK_LINKS !== "1" || url.hostname !== "track3.dev") continue;

    const site = resolve("../wsite9");
    const htmlFile = join(site, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname);
    expect(existsSync(htmlFile), `${value} is missing from the site snapshot`).toBe(true);
    if (url.hash) expect(readFileSync(htmlFile, "utf8")).toContain(`id="${url.hash.slice(1)}"`);

    let response = await fetch(value);
    for (let attempt = 0; attempt < 2 && response.status >= 500; attempt++) response = await fetch(value);
    expect(response.status, value).toBeLessThan(400);
  }
});
