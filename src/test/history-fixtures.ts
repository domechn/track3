export function* hourlyHistory(
  snapshotCount = 3 * 365 * 24,
  assetsPerSnapshot = 200,
): Generator<{
  id: string;
  createdAt: string;
  assets: { symbol: string; value: number; amount: number; price: number }[];
}, void> {
  const start = Date.UTC(2022, 0, 1);
  for (let snapshot = 0; snapshot < snapshotCount; snapshot++) {
    yield {
      id: `snapshot-${String(snapshot).padStart(6, "0")}`,
      createdAt: new Date(start + snapshot * 3_600_000).toISOString(),
      assets: Array.from({ length: assetsPerSnapshot }, (_, asset) => ({
        symbol: `ASSET${asset}`,
        value: asset + snapshot + 1,
        amount: 1,
        price: asset + snapshot + 1,
      })),
    };
  }
}
