import type React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { MenuItem } from "@tauri-apps/api/menu";
import { renderRightClickMenu } from "./hook";

vi.mock("@tauri-apps/api/menu", () => ({
  MenuItem: { new: vi.fn(async () => ({})) },
  Menu: { new: vi.fn(async () => ({ popup: vi.fn() })) },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("does not open a native context menu on iOS", async () => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone)");
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();

  await renderRightClickMenu({ preventDefault, stopPropagation } as unknown as React.MouseEvent);

  expect(MenuItem.new).not.toHaveBeenCalled();
  expect(preventDefault).not.toHaveBeenCalled();
  expect(stopPropagation).not.toHaveBeenCalled();
});
