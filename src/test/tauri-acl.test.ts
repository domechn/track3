import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const manifests = JSON.parse(readFileSync(join(root, "src-tauri/gen/schemas/acl-manifests.json"), "utf8")) as Record<string, {
  default_permission?: { permissions: string[] };
  permission_sets: Record<string, { permissions: string[] }>;
  permissions: Record<string, { commands: { allow: string[] } }>;
}>;

type Capability = {
  identifier: string;
  windows?: string[];
  webviews?: string[];
  platforms?: string[];
  permissions: (string | { identifier: string; allow?: { url?: string }[] })[];
};
const capabilities = readdirSync(join(root, "src-tauri/capabilities"))
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(join(root, "src-tauri/capabilities", name), "utf8")) as Capability);

const pluginCommands: Record<string, Record<string, string | string[] | null>> = {
  updater: { check: "check", download: "download", install: "install", downloadAndInstall: "download_and_install" },
  opener: { openUrl: "open_url", openPath: "open_path", revealItemInDir: "reveal_item_in_dir" },
  "clipboard-manager": { writeText: "write_text" },
  process: { relaunch: "restart", exit: "exit" },
  notification: { isPermissionGranted: "is_permission_granted", requestPermission: null, sendNotification: null },
  dialog: { open: "open", save: "save", message: "message", ask: "message", confirm: "message" },
  fs: {
    exists: "exists", stat: "stat", readDir: "read_dir", readFile: "read_file",
    readTextFile: "read_text_file", writeFile: "write_file", writeTextFile: "write_text_file",
    copyFile: "copy_file", rename: "rename", remove: "remove", mkdir: "mkdir",
  },
  http: { fetch: ["fetch", "fetch_send", "fetch_read_body", "fetch_cancel", "fetch_cancel_body"] },
  sql: { load: "load", select: "select", execute: "execute", close: "close" },
  store: { load: "load", get: "get", set: "set", save: "save", delete: "delete", clear: "clear" },
  shell: { open: "open" },
};

type Use = { command: string; file: string };

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : sourceFiles(file);
    return /\.(ts|tsx)$/.test(entry.name) && !/(\.test\.|\.spec\.|\.d\.ts$)/.test(entry.name) ? [file] : [];
  });
}

function commandsUsed(): Use[] {
  const uses: Use[] = [];
  for (const file of sourceFiles(join(root, "src"))) {
    const text = readFileSync(file, "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const bindings = new Map<string, { plugin: string; method?: string }>();
    let hasUpdater = false;
    let hasSql = false;
    let hasMenu = false;
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.importClause?.isTypeOnly) continue;
      const module = statement.moduleSpecifier.text;
      const plugin = module.match(/^@tauri-apps\/plugin-(.+)$/)?.[1];
      if (plugin) {
        expect(pluginCommands[plugin], `${relative(root, file)} imports an unaudited plugin: ${plugin}`).toBeDefined();
        hasUpdater ||= plugin === "updater";
        hasSql ||= plugin === "sql";
      }
      hasMenu ||= module === "@tauri-apps/api/menu";
      const group = plugin ?? (module === "@tauri-apps/api/path" ? "core:path" : module === "@tauri-apps/api/menu" ? "core:menu" : module === "@tauri-apps/api" ? "core:app" : "");
      if (!group || !statement.importClause) continue;
      if (statement.importClause.name) bindings.set(statement.importClause.name.text, { plugin: group });
      const named = statement.importClause.namedBindings;
      if (named && ts.isNamespaceImport(named)) bindings.set(named.name.text, { plugin: group });
      if (named && ts.isNamedImports(named)) {
        for (const element of named.elements) {
          if (!element.isTypeOnly) bindings.set(element.name.text, { plugin: group, method: element.propertyName?.text ?? element.name.text });
        }
      }
    }
    const add = (plugin: string, method: string) => {
      const command = plugin.startsWith("core:") ? coreCommands[plugin]?.[method] : pluginCommands[plugin]?.[method];
      expect(command, `${relative(root, file)} uses unaudited ${plugin}.${method}`).not.toBeUndefined();
      if (command === null) return;
      for (const name of Array.isArray(command) ? command : [command]) {
        uses.push({ command: `${plugin}|${name}`, file: relative(root, file) });
      }
    };
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const call = node.expression;
        if (ts.isIdentifier(call)) {
          const binding = bindings.get(call.text);
          if (binding?.method) add(binding.plugin, binding.method);
        } else if (ts.isPropertyAccessExpression(call)) {
          const target = call.expression;
          if (ts.isIdentifier(target)) {
            const binding = bindings.get(target.text);
            if (binding && !binding.method) add(binding.plugin, call.name.text);
            if (binding?.plugin === "core:menu") add("core:menu", call.name.text);
          } else if (ts.isPropertyAccessExpression(target) && ts.isIdentifier(target.expression)) {
            const binding = bindings.get(target.expression.text);
            if (binding?.plugin === "core:app") add("core:app", call.name.text);
          }
          if (hasUpdater && ["download", "install", "downloadAndInstall"].includes(call.name.text)) add("updater", call.name.text);
          if (hasUpdater && call.name.text === "close") add("core:resources", "close");
          if (hasSql && ["execute", "select", "close"].includes(call.name.text)) add("sql", call.name.text);
          if (hasMenu && call.name.text === "popup") add("core:menu", "popup");
        }
        if (ts.isIdentifier(call) && call.text === "invoke" && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.startsWith("plugin:")) {
          uses.push({ command: node.arguments[0].text.slice("plugin:".length), file: relative(root, file) });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (text.includes('import("@tauri-apps/plugin-opener")') && text.includes(".openUrl(")) add("opener", "openUrl");
  }
  return uses;
}

const coreCommands: Record<string, Record<string, string>> = {
  "core:app": { getVersion: "version", getTauriVersion: "tauri_version" },
  "core:path": { appCacheDir: "resolve_directory", appDataDir: "resolve_directory", documentDir: "resolve_directory" },
  "core:menu": { new: "new", popup: "popup" },
  "core:resources": { close: "close" },
};

function effectivePermissions(platform: string): string[] {
  return capabilities
    .filter((cap) => (cap.windows?.includes("main") || cap.windows?.includes("*") || cap.webviews?.includes("main") || cap.webviews?.includes("*")) &&
      (!cap.platforms || cap.platforms.includes(platform)))
    .flatMap((cap) => cap.permissions.map((permission) => typeof permission === "string" ? permission : permission.identifier));
}

function grantsCommand(identifier: string, wanted: string, seen = new Set<string>()): boolean {
  if (seen.has(identifier)) return false;
  seen.add(identifier);
  const index = identifier.lastIndexOf(":");
  const plugin = identifier.slice(0, index);
  const name = identifier.slice(index + 1);
  const manifest = manifests[plugin];
  if (!manifest) return false;
  const entry = name === "default" ? manifest.default_permission : manifest.permission_sets[name];
  if (entry) return entry.permissions.some((child) => grantsCommand(child.includes(":") ? child : `${plugin}:${child}`, wanted, new Set(seen)));
  return manifest.permissions[name]?.commands.allow?.some((command) => wanted === `${plugin}|${command}`) ?? false;
}

describe("Tauri ACL", () => {
  it("targets a window or webview in every capability", () => {
    for (const capability of capabilities) {
      expect((capability.windows?.length ?? 0) + (capability.webviews?.length ?? 0),
        `${capability.identifier} applies to no window or webview`).toBeGreaterThan(0);
    }
  });

  it.each(["macOS", "windows", "linux"] as const)("grants frontend plugin calls to main on %s", (platform) => {
    const permissions = effectivePermissions(platform);
    for (const use of commandsUsed()) {
      if (use.file.startsWith("src/mobile/")) continue;
      expect(permissions.some((permission) => grantsCommand(permission, use.command)),
        `${use.file}: plugin:${use.command} is not granted to main on ${platform}`).toBe(true);
    }
  });

  it("grants mobile plugin calls to main on iOS", () => {
    const permissions = effectivePermissions("iOS");
    for (const use of commandsUsed()) {
      if (use.file.startsWith("src/components/") || use.command === "process|restart") continue;
      expect(permissions.some((permission) => grantsCommand(permission, use.command)),
        `${use.file}: plugin:${use.command} is not granted to main on iOS`).toBe(true);
    }
  });

  it.each(["macOS", "iOS"] as const)("allows HTTP and HTTPS for rendered external links on %s", (platform) => {
    const opener = capabilities
      .filter((cap) => cap.windows?.includes("main") && cap.platforms?.includes(platform))
      .flatMap((cap) => cap.permissions)
      .filter((permission) => typeof permission !== "string" && permission.identifier === "opener:allow-open-url")
      .flatMap((permission) => typeof permission === "string" ? [] : permission.allow ?? [])
      .map((scope) => scope.url);
    expect(opener.some((url) => url?.startsWith("https://")), `${platform} HTTPS links`).toBe(true);
    expect(opener.some((url) => url?.startsWith("http://")), `${platform} HTTP links`).toBe(true);
  });
});
