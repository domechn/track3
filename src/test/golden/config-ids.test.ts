import { expect, it } from "vitest";
import { currentGolden, frozenGolden } from "./read-golden";

it("keeps configuration IDs, sync category map, and quote colour encoding", () => {
  expect(currentGolden("config-ids")).toEqual(frozenGolden("config-ids"));
});
