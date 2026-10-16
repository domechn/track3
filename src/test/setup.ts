import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Node >= 25 ships an experimental global `localStorage` getter that returns
// undefined (and warns) unless `--localstorage-file` is passed. It shadows the
// jsdom implementation, so re-expose jsdom's real Storage objects (tests spy on
// Storage.prototype, so a hand-rolled fake would not do).
function hasUsableStorage(name: "localStorage" | "sessionStorage"): boolean {
  try {
    return typeof globalThis[name]?.clear === "function";
  } catch {
    return false;
  }
}

const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;
if (jsdomWindow) {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    if (!hasUsableStorage(name)) {
      for (const target of [globalThis, window]) {
        Object.defineProperty(target, name, {
          configurable: true,
          get: () => jsdomWindow[name],
        });
      }
    }
  }
}
