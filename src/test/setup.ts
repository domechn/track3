import { cleanup, render } from "@testing-library/react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import * as React from "react";
import { I18nProvider } from "@/i18n";
import type { ReactElement } from "react";

const originalRender = render;

const renderI18n = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult => {
  const wrapper: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
    React.createElement(I18nProvider, null, children);
  return originalRender(ui, {
    wrapper,
    ...options,
  } as RenderOptions);
};

export { renderI18n };

afterEach(() => {
  cleanup();
});

if (!window.matchMedia) {
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

if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
