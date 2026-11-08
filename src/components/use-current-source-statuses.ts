import { useEffect, useState } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { getConfiguration } from "@/middlelayers/configuration";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { currentSourceStatusLabels, type CurrentSourceStatus } from "@/middlelayers/source-status-labels";

export function useCurrentSourceStatuses(statuses: PortfolioSourceStatus[]): CurrentSourceStatus[] {
  const version = useDataChangedVersion();
  const [current, setCurrent] = useState<{ statuses: PortfolioSourceStatus[]; value: CurrentSourceStatus[] }>({
    statuses, value: statuses,
  });

  useEffect(() => {
    let active = true;
    void getConfiguration().then((config) => {
      if (active) setCurrent({ statuses, value: config ? currentSourceStatusLabels(statuses, config) : statuses });
    }).catch(() => { if (active) setCurrent({ statuses, value: statuses }); });
    return () => { active = false; };
  }, [statuses, version]);

  return current.statuses === statuses ? current.value : statuses;
}
