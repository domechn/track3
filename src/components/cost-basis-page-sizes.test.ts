import { expect, it } from "vitest";
import { costBasisPageSizes } from "./cost-basis-page-sizes";

it("uses the requested desktop and phone row limits", () => {
  expect(costBasisPageSizes).toEqual({
    desktop: { lots: 10, gaps: 8 },
    phone: { lots: 8, gaps: 6 },
  });
});
