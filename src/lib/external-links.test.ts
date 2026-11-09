import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
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

it("lets a caller show its own link error without a second toast", async () => {
  vi.mocked(openUrl).mockRejectedValueOnce(new Error("opener unavailable"));
  const onError = vi.fn();
  await openExternal("latestRelease", onError);
  expect(onError).toHaveBeenCalledOnce();
  expect(toast).not.toHaveBeenCalled();
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
  const urlPattern = /https:\/\/[^/\s"'`]+|(?:[\w-]+\.)*track3\.(?:dev|app|io)\b/g;
  const files = execFileSync("git", ["ls-files", "-z", "--", "src"], { encoding: "utf8" })
    .split("\0")
    .filter((file) => /^src\/(?!test\/).*\.(?:tsx?|json)$/.test(file)
      && !/\.test\.tsx?$/.test(file) && file !== "src/lib/external-links.ts");

  function checkLiteral(literal: string, file: string) {
    for (const [match] of literal.matchAll(urlPattern)) {
      if (match.startsWith("https://")) {
        const host = new URL(match).hostname;
        if (!providerHosts.has(host) && !(file.endsWith(".json") && literal === "https://s3.example.com")) {
          failures.push(`${file}: ${literal}`);
        }
      } else if (!ownedHosts.has(match) && !providerHosts.has(match)) {
        failures.push(`${file}: ${match}`);
      }
    }
  }

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (text.search(urlPattern) < 0) continue;
    if (file.endsWith(".json")) {
      for (const value of Object.values(JSON.parse(text) as Record<string, string>)) checkLiteral(value, file);
      continue;
    }
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) checkLiteral(node.text, file);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(failures).toEqual([]);
}, 60_000);

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
