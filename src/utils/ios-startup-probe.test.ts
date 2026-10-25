import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";

it("captures a startup script error before the app module loads", () => {
  const html = readFileSync("index.html", "utf8");
  const script = html.match(/<script id="ios-startup-probe">([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();

  const invoke = vi.fn().mockResolvedValue(undefined);
  const probeWindow: {
    __TAURI_INTERNALS__: { invoke: typeof invoke };
    onerror?: (message: string, source: string, line: number, column: number, error: Error) => void;
    addEventListener: typeof vi.fn;
  } = { __TAURI_INTERNALS__: { invoke }, addEventListener: vi.fn() };
  new Function("window", script!.replace("%VITE_TRACK3_IOS_READY_PROBE%", "1"))(probeWindow);
  probeWindow.onerror?.("startup failed", "tauri://localhost/assets/app.js", 1, 2, new Error("startup failed"));
  expect(invoke).toHaveBeenCalledWith("record_frontend_error", {
    message: expect.stringContaining("startup failed"),
  });
});
