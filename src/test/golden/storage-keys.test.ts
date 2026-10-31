import { expect, it } from "vitest";
import { currentGolden, frozenGolden } from "./read-golden";

it("keeps current storage literals, key constants, and stored theme, locale, and onboarding values", () => {
  expect(currentGolden("storage-keys")).toEqual(frozenGolden("storage-keys"));
});
