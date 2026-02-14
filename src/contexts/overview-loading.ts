import { createContext } from "react";

export const OverviewLoadingContext = createContext<{
  reportLoaded: () => void;
}>({ reportLoaded: () => {} });
