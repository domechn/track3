import { createContext, useContext } from "react";

// Bumps whenever persisted data changes on disk — e.g. after a
// successful refresh, auto-import, data import, or right-click reload.
// Read this in a useEffect dependency list to make components that
// query the local SQLite DB re-fetch on data change. It is intentionally
// separate from dateRange so a refresh that doesn't move the selected
// range still triggers a re-query.
export const DataChangedContext = createContext<number>(0);

export function useDataChangedVersion(): number {
  return useContext(DataChangedContext);
}
