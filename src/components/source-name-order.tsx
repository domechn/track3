import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { queryHistoricalPage } from "@/middlelayers/charts";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { needsWalletName } from "./source-display-name";

const SourceNameOrder = createContext<Readonly<Record<string, number>> | undefined>(undefined);

export function useLatestWalletOrdinals() {
  return useContext(SourceNameOrder);
}

export function LatestSourceNamesProvider({ ready, children }: { ready: boolean; children: ReactNode }) {
  const version = useDataChangedVersion();
  const [ordinals, setOrdinals] = useState<Readonly<Record<string, number>>>({});

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void (async () => {
      const latest = (await queryHistoricalPage({
        start: new Date(0), end: new Date("9999-12-31T23:59:59.999Z"),
      }, 1, 0)).rows[0];
      const totals = new Map<string, number>();
      if (latest) for (const asset of await ASSET_HANDLER.listAssetsByUUIDs([latest.id])) {
        if (asset.wallet && asset.uuid === latest.id)
          totals.set(asset.wallet, (totals.get(asset.wallet) ?? 0) + asset.value);
      }
      const identities: Awaited<ReturnType<WalletAnalyzer["listWalletAliases"]>> =
        await new WalletAnalyzer(async () => []).listWalletAliases([...totals.keys()]).catch(() => ({}));
      const ids = [...totals.keys()].filter((id) => needsWalletName({ id, ...identities[id] }))
        .sort((a, b) => totals.get(b)! - totals.get(a)! || a.localeCompare(b));
      if (active) setOrdinals(Object.fromEntries(ids.map((id, index) => [id, index + 1])));
    })().catch(() => { if (active) setOrdinals({}); });
    return () => { active = false; };
  }, [ready, version]);

  return <SourceNameOrder.Provider value={ordinals}>{children}</SourceNameOrder.Provider>;
}
