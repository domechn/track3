import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DataChangedContext } from "@/contexts/data-changed";
import { getConfiguration } from "@/middlelayers/configuration";
import { configurationFromForm } from "@/middlelayers/ui-state/config-form";
import { useCurrentSourceStatuses } from "./use-current-source-statuses";

vi.mock("@/middlelayers/configuration", () => ({ getConfiguration: vi.fn() }));

function Labels({ stored }: { stored: { sourceId: string; label: string; status: "ok" }[] }) {
  const statuses = useCurrentSourceStatuses(stored);
  return <span>{statuses.map((status) => status.label).join(", ")}</span>;
}

it("resolves stored status names again after a config change without changing the stored status", async () => {
  const stored = [{ sourceId: "cex:0", label: "Main", provider: "Binance",
    hint: "samp…1234", status: "ok" as const }];
  const config = configurationFromForm({
    exchanges: [{ type: "binance", alias: "Main", active: true, apiKey: "sample-key-1234", secret: "" }],
    wallets: [], stockBrokers: [], others: [], groupUSD: false, hideInactive: false,
  });
  vi.mocked(getConfiguration).mockImplementation(async () => config);
  const view = render(<DataChangedContext.Provider value={0}><Labels stored={stored} /></DataChangedContext.Provider>);
  expect(screen.getByText("Main")).toBeInTheDocument();
  config.exchanges[0].alias = "Trading";
  view.rerender(<DataChangedContext.Provider value={1}><Labels stored={stored} /></DataChangedContext.Provider>);
  expect(await screen.findByText("Trading")).toBeInTheDocument();
  expect(stored[0].label).toBe("Main");
});
