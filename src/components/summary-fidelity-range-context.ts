import { createContext } from "react";
import type { TDateRange } from "@/middlelayers/types";

export const SummaryFidelityRangeContext = createContext<{
  range?: TDateRange;
  setRange: (range: TDateRange | undefined) => void;
  label: string;
  setLabel: (label: string) => void;
  availableDates: Date[];
}>({ setRange: () => {}, label: "All", setLabel: () => {}, availableDates: [] });

export const SummaryFidelityYearContext = createContext<{
  year: number;
  setYear: (year: number) => void;
  moverNames: string[];
  setMoverNames: (names: string[]) => void;
}>({ year: 0, setYear: () => {}, moverNames: [], setMoverNames: () => {} });
