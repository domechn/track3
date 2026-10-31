import { expect, it } from "vitest";
import { currentGolden, frozenGolden } from "./read-golden";

it("keeps all desktop and mobile hash routes and Settings destinations", () => {
  const current = currentGolden("routes") as Record<string, string[]>;
  const frozen = frozenGolden("routes") as Record<string, string[]>;
  for (const [source, routes] of Object.entries(frozen)) {
    expect(current[source]).toEqual(expect.arrayContaining(routes));
  }
});
