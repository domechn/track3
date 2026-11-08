import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { expect, it } from "vitest";

it("defines one rail active background across desktop and mobile styles", () => {
  const files = [
    "src/style.css",
    "src/components/index/index.css",
    "src/components/rebalance-desktop.css",
    "src/mobile/ios-style.css",
    "src/mobile/components/mobile/fidelity.css",
    "src/mobile/components/mobile/mobile.css",
    "src/mobile/components/plan-fidelity.css",
  ];
  const backgrounds: string[] = [];
  for (const file of files) {
    const root = postcss.parse(readFileSync(resolve(file), "utf8"), { from: file });
    root.walkRules((rule) => {
      if (!/(?:rail|sidebar|nav-item|tab)/.test(rule.selector) ||
        !/(?:\[aria-current=["']page["']\]|\.selected)/.test(rule.selector) ||
        /::before|::after|:not\(\[aria-current/.test(rule.selector)) return;
      rule.walkDecls(/^(?:background|background-color)$/, () => {
        backgrounds.push(`${file}:${rule.selector}`);
      });
    });
  }
  expect(backgrounds).toEqual(["src/style.css:.t3-nav-item[aria-current=\"page\"]"]);
});

it("keeps selected desktop controls on the shared tint and foreground", () => {
  const styles = ["src/style.css", "src/components/first-run-overview.css"]
    .map((file) => postcss.parse(readFileSync(resolve(file), "utf8"), { from: file }));
  const selectors = [
    ".t3-fr-ranges button[aria-pressed=\"true\"]",
    ".t3-fr-choice[aria-pressed=\"true\"]",
    ".t3-fidelity-appearance .theme-choice[aria-checked=\"true\"]",
    ".t3-fidelity-appearance .colour-choice[aria-checked=\"true\"]",
    ".t3-fidelity-language .options button[aria-checked=\"true\"]",
    ".t3-cmp-calendar-days button.selected",
  ];
  for (const selector of selectors) {
    const rules = styles.flatMap((root) => {
      const matches: Array<{ background?: string; color?: string }> = [];
      root.walkRules((rule) => {
        if (!rule.selector.split(",").map((part) => part.trim()).includes(selector)) return;
        const declarations: { background?: string; color?: string } = {};
        rule.walkDecls(/^(background|color)$/, (decl) => { declarations[decl.prop as "background" | "color"] = decl.value; });
        matches.push(declarations);
      });
      return matches;
    });
    expect(rules.map((rule) => rule.background).filter(Boolean).at(-1), selector).toBe("var(--nav-selected-background)");
    expect(rules.map((rule) => rule.color).filter(Boolean).at(-1), selector).toBe("hsl(var(--foreground))");
  }
});

it("uses the shared tint for range presets and mobile plan segments", () => {
  const buttonGroup = readFileSync(resolve("src/components/ui/button-group.tsx"), "utf8");
  expect(buttonGroup).toContain("data-[state=checked]:bg-[var(--nav-selected-background)]");
  expect(buttonGroup).toContain("data-[state=checked]:text-foreground");
  const root = postcss.parse(readFileSync(resolve("src/mobile/components/plan-fidelity.css"), "utf8"));
  const selected: Array<{ selector: string; background?: string; shadow?: string }> = [];
  root.walkRules((rule) => {
    if (!rule.selector.split(",").map((part) => part.trim()).includes(".pf-segment button.active::before") &&
      !rule.selector.split(",").map((part) => part.trim()).includes(".light .pf-segment button.active::before")) return;
    const declarations: { selector: string; background?: string; shadow?: string } = { selector: rule.selector };
    rule.walkDecls(/^(background|box-shadow)$/, (decl) => {
      declarations[decl.prop as "background" | "shadow"] = decl.value;
    });
    selected.push(declarations);
  });
  expect(selected.map(({ background }) => background)).toEqual([
    "var(--nav-selected-background)",
    "var(--nav-selected-background)",
  ]);
  expect(selected.every(({ shadow }) => shadow === undefined)).toBe(true);
});

it("keeps the expanded mobile rail outside the left safe area", () => {
  const root = postcss.parse(readFileSync(resolve("src/mobile/components/mobile/mobile.css"), "utf8"));
  const rules: Array<Record<string, string>> = [];
  root.walkRules((rule) => {
    if (rule.selector !== ".mobile-sidebar") return;
    const declarations: Record<string, string> = {};
    rule.walkDecls((decl) => { declarations[decl.prop] = decl.value; });
    if (declarations["--nav-rail-inset"]) rules.push(declarations);
  });
  const rail = rules.at(-1);
  expect(rail?.padding).toContain("calc(var(--mobile-safe-left) + 10px)");
  expect(rail?.["--nav-rail-inset"]).toBe("calc(var(--mobile-safe-left) + 10px)");
  expect(rail?.["--nav-scroll-inset"]).toBe("calc(var(--mobile-safe-left) + 10px)");
});

it("positions the collapsed Goals badge the same on every desktop route", () => {
  const root = postcss.parse(readFileSync(resolve("src/style.css"), "utf8"));
  const rules: Array<Record<string, string>> = [];
  root.walkRules((rule) => {
    if (rule.selector !== '.t3-desktop-rail.t3-rail-collapsed a[href="#/goals"] > span[aria-hidden="true"]') return;
    const declarations: Record<string, string> = {};
    rule.walkDecls((decl) => { declarations[decl.prop] = decl.value; });
    rules.push(declarations);
  });
  expect(rules.at(-1)).toMatchObject({ top: "7px", right: "7px" });
});

it("keeps an inset focus ring on navigation controls", () => {
  const root = postcss.parse(readFileSync(resolve("src/style.css"), "utf8"));
  const shadows: string[] = [];
  root.walkRules((rule) => {
    if (rule.selector !== ".t3-nav-item:focus-visible") return;
    rule.walkDecls("box-shadow", (decl) => { shadows.push(decl.value); });
  });
  expect(shadows.at(-1)).toBe("inset 0 0 0 2px hsl(var(--ring))");
});

it("keeps expanded touch rail paint corners circular", () => {
  for (const file of ["src/style.css", "src/mobile/components/mobile/mobile.css"]) {
    const root = postcss.parse(readFileSync(resolve(file), "utf8"));
    const selector = file === "src/style.css"
      ? ".t3-desktop-rail:not(.t3-rail-collapsed) .t3-nav-item"
      : '.mobile-sidebar:not([data-collapsed="true"]) .t3-nav-item';
    const rules: Array<Record<string, string>> = [];
    root.walkRules((rule) => {
      if (rule.selector !== selector) return;
      const declarations: Record<string, string> = {};
      rule.walkDecls((decl) => { declarations[decl.prop] = decl.value; });
      if (declarations["background-clip"]) rules.push(declarations);
    });
    expect(rules.at(-1)?.padding, file).toBe("4px");
  }
});

it("uses the selected tint in both calendars", () => {
  const root = postcss.parse(readFileSync(resolve("src/mobile/components/mobile/fidelity.css"), "utf8"));
  const dayRules: Array<{ selector: string; background: string }> = [];
  root.walkRules((rule) => {
    if (!rule.selector.includes(".fd-overview-days button[data-between=") &&
      !rule.selector.includes(".fd-overview-days button[data-selected=")) return;
    rule.walkDecls("background", (decl) => { dayRules.push({ selector: rule.selector, background: decl.value }); });
  });
  expect(dayRules.filter(({ selector }) => !selector.endsWith(" b")).map(({ background }) => background))
    .toEqual(["var(--nav-selected-background)"]);
  const calendar = readFileSync(resolve("src/components/ui/calendar.tsx"), "utf8");
  expect(calendar).toContain("day_selected:");
  expect(calendar).toContain("bg-[var(--nav-selected-background)] text-foreground");
});

it("keeps the selected year card tint in light mode", () => {
  const root = postcss.parse(readFileSync(resolve("src/style.css"), "utf8"));
  const lightOverrides: string[] = [];
  root.walkRules((rule) => {
    if (rule.selector.startsWith(".light :is(") && rule.selector.includes(".fidelity-year-card") &&
      !rule.selector.includes(".fidelity-year-card:not(.selected)")) lightOverrides.push(rule.selector);
  });
  expect(lightOverrides).toEqual([]);
});

it("keeps mobile choice surfaces on the shared selected tint", () => {
  const root = postcss.parse(readFileSync(resolve("src/mobile/components/mobile/mobile.css"), "utf8"));
  for (const selector of [
    '.fidelity-attach-options button[aria-checked="true"]',
    ".fidelity-language-option.is-selected",
    '.fidelity-currency-options button[aria-selected="true"]',
    '.fidelity-custom-segment button[aria-checked="true"]',
  ]) {
    const backgrounds: string[] = [];
    root.walkRules((rule) => {
      if (rule.selector !== selector) return;
      rule.walkDecls("background", (decl) => { backgrounds.push(decl.value); });
    });
    expect(backgrounds.at(-1), selector).toBe("var(--nav-selected-background)");
  }
});

it("does not add conditional Tailwind backgrounds to current TSX navigation items", () => {
  const offenders: string[] = [];
  for (const file of globSync("src/**/*.tsx")) {
    const source = readFileSync(resolve(file), "utf8");
    for (const tag of source.matchAll(/<(?:Link|button|a)\b[^>]*aria-current[^>]*>/gs)) {
      if (/className=\{[^>]*\b(?:current|ariaCurrent)\s*(?:&&|\?)[^>]*\bbg-[\w/-]+/s.test(tag[0])) {
        offenders.push(file);
      }
    }
  }
  expect(offenders).toEqual([]);
});
