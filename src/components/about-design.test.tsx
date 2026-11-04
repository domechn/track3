import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { check } from "@tauri-apps/plugin-updater";
import { toast } from "@/components/ui/use-toast";
import { AboutDesign } from "./about-design";

vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/path", () => ({ appDataDir: vi.fn(async () => "/sample/data") }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));

it("checks for updates and reports when the installed version is current", async () => {
  render(<AboutDesign version="0.9.4" />);
  fireEvent.click(screen.getByTestId("about-check-updates"));
  expect(await screen.findByText("Track3 is up to date.", { exact: true })).toBeInTheDocument();
  expect(check).toHaveBeenCalledOnce();
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({
    title: "Track3 is up to date",
    tone: "success",
  }));
});

it("displays package versions without dependency range markers", () => {
  const { container } = render(<AboutDesign version="0.9.4" />);
  const reactRow = Array.from(container.querySelectorAll(".t3-b-about-license-row"))
    .find((row) => row.textContent?.includes("React"));
  expect(reactRow).toHaveTextContent("18.3.1");
  expect(reactRow?.textContent).not.toContain("^");
});
