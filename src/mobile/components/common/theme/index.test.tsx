import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/mobile/components/common/theme";

function ThemeProbe() {
  return <span>{useTheme().resolvedTheme}</span>;
}

afterEach(() => {
  localStorage.removeItem("track3-ui-theme");
  vi.restoreAllMocks();
});

it("updates the system theme while the app remains open", () => {
  localStorage.removeItem("track3-ui-theme");
  let dark = false;
  let changed: (() => void) | undefined;
  vi.spyOn(window, "matchMedia").mockImplementation(() => ({
    get matches() { return dark; },
    addEventListener: (_event: string, listener: EventListenerOrEventListenerObject) => { changed = listener as () => void; },
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList));
  render(<ThemeProvider defaultTheme="system"><ThemeProbe /></ThemeProvider>);
  expect(document.documentElement).toHaveClass("light");
  expect(screen.getByText("light")).toBeInTheDocument();
  dark = true;
  act(() => changed?.());
  expect(document.documentElement).toHaveClass("dark");
  expect(screen.getByText("dark")).toBeInTheDocument();
});
