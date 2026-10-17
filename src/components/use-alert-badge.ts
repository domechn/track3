import { useEffect, useState } from "react";
import { ALERTS_CHANGED_EVENT, countUnreadAlerts } from "@/middlelayers/alerts";

export function useAlertBadge(): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void countUnreadAlerts().then((count) => {
        if (active) setUnread(count);
      }).catch(() => {
        if (active) setUnread(0);
      });
    };
    refresh();
    window.addEventListener(ALERTS_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(ALERTS_CHANGED_EVENT, refresh);
    };
  }, []);
  return unread;
}
