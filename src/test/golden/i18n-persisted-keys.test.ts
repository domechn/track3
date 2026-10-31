import { expect, it } from "vitest";
import { currentGolden, frozenGolden } from "./read-golden";

it("keeps every 0.9.4 catalog key and every persisted message key in all four catalogs", () => {
  const current = currentGolden("i18n-keys-0.9.4") as Record<string, string[]>;
  const frozen = frozenGolden("i18n-keys-0.9.4") as Record<string, string[]>;
  for (const [catalog, keys] of Object.entries(frozen)) {
    expect(current[catalog]).toEqual(expect.arrayContaining(keys));
  }
  const persisted = frozen["src/i18n/locales/en.json"]
    .filter((key) => key.startsWith("assistant.action.")
      || key.startsWith("insights.")
      || key.startsWith("goals.kind.")
      || key === "goals.alertTriggered");
  for (const keys of Object.values(current)) {
    expect(keys).toEqual(expect.arrayContaining(persisted));
  }
});
