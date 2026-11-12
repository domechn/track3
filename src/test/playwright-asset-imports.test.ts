import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { it } from "vitest";

const root = resolve(__dirname, "../..");
const sources = new Map<string, string[]>();

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : entry.name.endsWith(".ts") ? [path] : [];
  });
}

function localImports(file: string): string[] {
  const cached = sources.get(file);
  if (cached) return cached;

  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly &&
      !(node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
        !node.importClause.name && node.importClause.namedBindings.elements.every((item) => item.isTypeOnly)) &&
      ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly &&
      !(node.exportClause && ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.every((item) => item.isTypeOnly)) &&
      node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        ts.isIdentifier(node.expression) && node.expression.text === "require") &&
      ts.isStringLiteral(node.arguments[0])) {
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  const resolved = imports.flatMap((name) => {
    if (!name.startsWith("./") && !name.startsWith("../") && !name.startsWith("@/")) return [];
    const base = name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(file), name);
    const candidates = [base, ...[".ts", ".tsx", ".js", ".jsx"].map((ext) => base + ext),
      ...[".ts", ".tsx", ".js", ".jsx"].map((ext) => join(base, "index" + ext))];
    const target = candidates.find((path) => existsSync(path) && statSync(path).isFile());
    return target ? [target] : [];
  });
  sources.set(file, resolved);
  return resolved;
}

function assetChain(file: string, seen: Set<string>): string[] | undefined {
  if (seen.has(file)) return;
  seen.add(file);
  if (/\.(svg|png|jpe?g|webp)$/i.test(file)) return [file];
  for (const imported of localImports(file)) {
    const chain = assetChain(imported, seen);
    if (chain) return [file, ...chain];
  }
}

it("keeps Playwright specs and helpers free of transitive image imports", () => {
  for (const file of filesIn(join(root, "tests/e2e"))) {
    const chain = assetChain(file, new Set());
    if (chain) {
      throw new Error(`Playwright image import chain:\n${chain.map((path) => relative(root, path)).join("\n→ ")}`);
    }
  }
});
