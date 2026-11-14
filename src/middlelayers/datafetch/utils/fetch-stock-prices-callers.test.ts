import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

const srcRoot = path.resolve(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [fullPath] : [];
  });
}

it("routes stock quote callers through saved-cash checks or IBKR fund positions", () => {
  const callers: Record<string, string[]> = {};
  for (const file of sourceFiles(srcRoot)) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const declarations = new Map<string, string[]>();
    const calls: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const values = declarations.get(node.name.text) ?? [];
        values.push(node.initializer.getText(source));
        declarations.set(node.name.text, values);
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        node.expression.text === "fetchStockPrices") {
        expect(node.arguments).toHaveLength(1);
        expect(ts.isIdentifier(node.arguments[0])).toBe(true);
        calls.push(node.arguments[0].getText(source));
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    if (!calls.length) continue;
    const relative = path.relative(srcRoot, file).replaceAll(path.sep, "/");
    callers[relative] = calls;
    for (const arg of calls) {
      const initializers = declarations.get(arg) ?? [];
      expect(initializers.length, `${relative}: ${arg} has no local source`).toBeGreaterThan(0);
      expect(initializers.every((initializer) =>
        arg === "fundSymbols"
          ? /position\.kind === "fund"/.test(initializer)
          : arg === "stockPriceSymbols"
            ? /!savedStockRows \|\| !isBrokerCashSymbol\(/.test(initializer)
            : /!isBrokerCashSymbol\(/.test(initializer)),
      `${relative}: ${arg} must handle saved broker cash or select IBKR funds`).toBe(true);
    }
  }
  expect(callers).toEqual({
    "middlelayers/charts-refresh.ts": ["stockPriceSymbols", "stockSymbols", "stockSymbols"],
    "middlelayers/datafetch/coins/stock/ibkr.ts": ["fundSymbols"],
    "middlelayers/ai/skills/functions/prices.ts": ["quoteSymbols"],
  });
});
