import { globSync, readFileSync } from "node:fs";
import postcss from "postcss";
import { expect, it } from "vitest";

const overlaySelector = /dialog|popover|toast|sheet|scrim|tooltip|menu|modal|overlay|drawer|delete|alert|confirm|picker|editor|sync-fidelity|fd-sync|fd-partial-status|fd-refresh-progress|fidelity-sync|fidelity-b-sync|fidelity-(?:quicklook|attach|remove|guide|custom)|coin-fidelity-(?:imported|changed|hint|price-input|value-hint|custom-warning|custom-settings)|ob-fidelity|ob-desktop|fd-guide|pf-delete|pf-grabber|pf-profile-actions|pf-rules-links/i;
const rawColor = /#[\da-f]{3,8}\b|rgba?\(|\bwhite\b|\bblack\b/i;
const exemption = /\/\* theme-exempt: \S[^*]* \*\//;

function rawOverlayColors(css: string, file: string): string[] {
  const lines = css.split("\n");
  const failures: string[] = [];
  postcss.parse(css, { from: file }).walkRules((rule) => {
    if (!overlaySelector.test(rule.selector)) return;
    rule.walkDecls((declaration) => {
      if (!rawColor.test(declaration.value)) return;
      const line = declaration.source?.start?.line ?? 1;
      if (!exemption.test(lines[line - 1])) {
        failures.push(`${file}:${line} ${rule.selector} { ${declaration.prop}: ${declaration.value} }`);
      }
    });
  });
  return failures;
}

it("rejects raw overlay colors unless the declaration has a documented theme exemption", () => {
  expect(rawOverlayColors(".modal { color: #fff; }", "fixture.css")).toHaveLength(1);
  expect(rawOverlayColors(".goal-drawer { color: #fff; }", "fixture.css")).toHaveLength(1);
  expect(rawOverlayColors(".comparison-picker button { background: #fff; }", "fixture.css")).toHaveLength(1);
  expect(rawOverlayColors(".fidelity-custom-editor select { background: #0a0a0b; }", "fixture.css")).toHaveLength(1);
  expect(rawOverlayColors(".pf-editor input { color: #fff; }", "fixture.css")).toHaveLength(1);
  expect(rawOverlayColors(".pf-profile-actions { box-shadow: 0 2px #0005; }", "fixture.css")).toHaveLength(1);
  expect(rawOverlayColors(".pf-rules-links { box-shadow: 0 2px #0005; }", "fixture.css")).toHaveLength(1);
  expect(rawOverlayColors(".fd-partial-status-handle { background: #44454b; }", "fixture.css")).toHaveLength(1);
  expect(rawOverlayColors(".fd-refresh-progress-row small { color: #b4b6bc; }", "fixture.css")).toHaveLength(1);
  expect(rawOverlayColors(".modal { color: #fff; /* theme-exempt: fixed brand artwork */ }", "fixture.css")).toEqual([]);
  const failures = globSync("src/**/*.css").flatMap((file) =>
    rawOverlayColors(readFileSync(file, "utf8"), file));
  expect(failures).toEqual([]);
});
