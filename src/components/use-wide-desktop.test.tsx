import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useWideDesktop } from "./use-wide-desktop";

function Probe() {
  return <span>{String(useWideDesktop())}</span>;
}

afterEach(() => vi.unstubAllGlobals());

it("stays narrow when matchMedia is unavailable", () => {
  vi.stubGlobal("matchMedia", undefined);
  render(<Probe />);
  expect(screen.getByText("false")).toBeInTheDocument();
});

it("responds to resize events from older media-query listeners", () => {
  let matches = false;
  let notify = () => {};
  vi.stubGlobal("matchMedia", () => ({
    get matches() { return matches; },
    addListener: (listener: () => void) => { notify = listener; },
    removeListener: vi.fn(),
  }));
  render(<Probe />);
  expect(screen.getByText("false")).toBeInTheDocument();
  act(() => { matches = true; notify(); });
  expect(screen.getByText("true")).toBeInTheDocument();
});
