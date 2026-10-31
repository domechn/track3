import { expect, it } from "vitest";
import { currentGolden, frozenGolden } from "./read-golden";

it("keeps persistence-bearing desktop and mobile UI lines", () => {
  expect(currentGolden("ui-persistence-inventory")).toEqual(frozenGolden("ui-persistence-inventory"));
});
