import { createContext, type Dispatch, type SetStateAction } from "react";

export const SummaryLoadingContext = createContext<Dispatch<SetStateAction<boolean>>>(() => {});
