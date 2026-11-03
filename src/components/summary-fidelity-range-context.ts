import { createContext } from "react";
import type { TDateRange } from "@/middlelayers/types";

export const SummaryFidelityRangeContext = createContext<{
  range?: TDateRange;
  setRange: (range: TDateRange | undefined) => void;
}>({ setRange: () => {} });

export const SummaryFidelityYearContext = createContext<{
  year: number;
  setYear: (year: number) => void;
}>({ year: 0, setYear: () => {} });
