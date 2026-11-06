import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { check } from "@tauri-apps/plugin-updater";
import { toast } from "@/components/ui/use-toast";
import { AboutDesign } from "./about-design";
import notes096 from "./release-notes.fixture.md?raw";

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

it("shows the two-peak mark beside the app name", () => {
  const { container } = render(<AboutDesign version="0.9.4" />);
  expect(container.querySelectorAll(".t3-b-about-brand polygon")).toHaveLength(2);
});

it("shows checked update notes with the shared Markdown layout", async () => {
  vi.mocked(check).mockResolvedValueOnce({
    available: true, version: "0.9.6", currentVersion: "0.9.4", body: notes096,
  } as Awaited<ReturnType<typeof check>>);
  render(<AboutDesign version="0.9.4" />);
  fireEvent.click(screen.getByTestId("about-check-updates"));
  const dialog = await screen.findByRole("dialog");
  expect(dialog.querySelector(".t3-update-fidelity-notes")).toContainElement(screen.getByRole("heading", { name: "🎉 Features" }));
  expect(dialog.querySelector(".t3-update-fidelity-notes")).not.toContainElement(screen.getByRole("button", { name: "Download and install" }));
});

it("keeps the old plain update headings outside list items", async () => {
  vi.mocked(check).mockResolvedValueOnce({
    available: true, version: "0.9.5", currentVersion: "0.9.4",
    body: "New\n- Sync status shows phase timings, request counters and a Copy diagnostics button.\n- Import lists every conflict so you pick per item what to keep.\nImproved\n- ERC20 wallet refreshes finish faster for wallets with many tokens.\n- Assistant replies stream while tools run.\nFixed\n- Goals and alerts cooldown now follows the selected window.\n- History keeps your page after you delete a snapshot.",
  } as Awaited<ReturnType<typeof check>>);
  render(<AboutDesign version="0.9.4" />);
  fireEvent.click(screen.getByTestId("about-check-updates"));
  const dialog = await screen.findByRole("dialog");
  for (const heading of ["New", "Improved", "Fixed"]) {
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  }
  expect(dialog.querySelectorAll(".t3-update-fidelity-notes li")).toHaveLength(6);
  expect(Array.from(dialog.querySelectorAll("li")).some((item) => item.textContent?.includes("Improved"))).toBe(false);
});
