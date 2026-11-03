import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import DesktopErrorBoundary from "./desktop-error-boundary";
import { reloadApp } from "@/utils/app";
import { getDatabase } from "@/middlelayers/database";

vi.mock("@/utils/app", () => ({ reloadApp: vi.fn() }));
vi.mock("@/middlelayers/database", () => ({
  getDatabase: vi.fn(async () => ({ select: async () => [{ data: "0.9.5" }] })),
}));

function BrokenScreen(): never {
  throw new Error("Renderer failed");
}

it("shows a usable recovery screen when a desktop component crashes", async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: copy } });
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const preventJsdomError = (event: ErrorEvent) => event.preventDefault();
  window.addEventListener("error", preventJsdomError);
  try {
    render(<DesktopErrorBoundary><BrokenScreen /></DesktopErrorBoundary>);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    expect(screen.getByText(/Renderer failed/)).toBeVisible();
    await waitFor(() => expect(screen.getByText(/Track3 .* · schema 0.9.5 · .* · /)).toBeVisible());
    expect(screen.getByRole("button", { name: "Copy details" }).querySelector("svg")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy details" }));
    expect(copy).toHaveBeenCalledWith(expect.stringContaining("Renderer failed"));
    expect(copy).toHaveBeenCalledWith(expect.stringContaining("BrokenScreen"));
    expect(getDatabase).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reloadApp).toHaveBeenCalledOnce();
  } finally {
    consoleError.mockRestore();
    window.removeEventListener("error", preventJsdomError);
    vi.unstubAllGlobals();
  }
});
