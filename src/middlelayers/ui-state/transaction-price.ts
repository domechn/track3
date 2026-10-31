export function persistedTransactionPrice(dirty: boolean, quotePrice: number, rate: number, original: number): number {
  return dirty ? quotePrice / rate : original;
}
