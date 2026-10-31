import { expect, it } from "vitest";
import { rebalanceCsvDialogOptions, rebalanceCsvFilename } from "./rebalance-export";

it("keeps the default CSV filename and file picker filter", () => {
  expect(rebalanceCsvFilename).toBe("track3-rebalance.csv");
  expect(rebalanceCsvDialogOptions()).toEqual({ defaultPath: "track3-rebalance.csv", filters: [{ name: "track3-rebalance", extensions: ["csv"] }] });
});
