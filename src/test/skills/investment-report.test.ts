import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

describe("investment report generator", () => {
  it("omits raw amounts from the generated HTML when sensitive values are hidden", async () => {
    const generatorModuleUrl = pathToFileURL(
      resolve(
        process.cwd(),
        ".agents/skills/investment-report/lib/report-generator.mjs",
      ),
    );
    const { renderInvestmentShareHtml } = (await import(
      /* @vite-ignore */ generatorModuleUrl.href
    )) as {
      renderInvestmentShareHtml: (input: unknown) => string;
    };

    const html = renderInvestmentShareHtml({
      title: "2025-2026 Investment Report",
      subtitle: "From accumulation to discipline",
      period: {
        from: "2025-01-01",
        to: "2026-12-31",
        label: "2025 - 2026",
      },
      privacy: {
        showAmounts: false,
        showAllocationAmounts: false,
        showTickers: true,
      },
      currency: "USD",
      summary: {
        startingValue: 120000,
        endingValue: 186000,
        netContribution: 42000,
        netProfit: 24000,
        totalReturnPct: 36.5,
        maxDrawdownPct: -12.4,
      },
      highlights: [
        {
          label: "Best month",
          value: "+8.2%",
          detail: "2026-03",
        },
      ],
      allocation: [
        {
          name: "BTC",
          weight: 45,
          amount: 83700,
          changePct: 18.2,
          color: "#f59e0b",
        },
        {
          name: "Nasdaq ETF",
          weight: 30,
          amount: 55800,
          changePct: 9.8,
          color: "#0f766e",
        },
      ],
      narrative: {
        headline: "A disciplined two-year compounding stretch",
        bullets: [
          "Added risk slowly during drawdowns.",
          "Reduced concentration after sharp rallies.",
        ],
      },
    });

    expect(html).toContain("2025 - 2026");
    expect(html).toContain("A disciplined two-year compounding stretch");
    expect(html).toContain("application/json");
    expect(html).toContain("******");
    expect(html).toContain("36.5%");
    expect(html).not.toContain("186000");
    expect(html).not.toContain("83700");
    expect(html).not.toContain("55800");
  });
});
