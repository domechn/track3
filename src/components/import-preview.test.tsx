import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ImportPreview from "./import-preview";
import type { ImportPreviewRow } from "@/middlelayers/datamanager";
import zh from "@/i18n/locales/zh.json";

it("shows each snapshot and applies row and bulk choices without hiding collision warnings", () => {
  const rows: ImportPreviewRow[] = [
    { uuid: "new", createdAt: "2024-01-01T00:00:00Z", total: 5, assetCount: 2, status: "new", choice: "import", transactionIdCollisions: 1 },
    { uuid: "same", createdAt: "2024-01-02T00:00:00Z", total: 6, assetCount: 3, status: "same", choice: "skip", transactionIdCollisions: 0 },
    { uuid: "different", createdAt: "2024-01-03T00:00:00Z", total: 7, assetCount: 4, status: "different", choice: "keep", transactionIdCollisions: 0 },
  ];
  const onImport = vi.fn();
  render(<ImportPreview rows={rows} onImport={onImport} onCancel={() => {}} busy={false} />);

  expect(screen.getByRole("alert")).toHaveTextContent("transaction ID");
  for (const row of rows) {
    expect(screen.getByText(new Intl.DateTimeFormat("en-US",
      { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(row.createdAt)))).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole("button", { name: "Replace all different" }));
  fireEvent.change(within(screen.getByTestId("import-row-new")).getByRole("combobox"), { target: { value: "skip" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply selected choices" }));
  expect(onImport).not.toHaveBeenCalled();
  expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm replacement" }));
  expect(onImport).toHaveBeenCalledWith({ new: "skip", same: "skip", different: "replace" });
});

it("lists failed snapshot IDs after successful rows commit", () => {
  render(<ImportPreview rows={[]} onImport={() => {}} onCancel={() => {}} busy={false}
    result={{ imported: 1, replaced: 0, skipped: 0, failures: [{ uuid: "failed-id", error: "replace failed" }] }} />);
  expect(screen.getByRole("status")).toHaveTextContent("1 imported");
  expect(screen.getByText(/failed-id/)).toHaveTextContent("replace failed");
});

it("distinguishes snapshots recorded on the same date by time", () => {
  const rows: ImportPreviewRow[] = [
    { uuid: "early", createdAt: "2024-01-01T01:00:00.000Z", total: 1, assetCount: 1, status: "new", choice: "import", transactionIdCollisions: 0 },
    { uuid: "late", createdAt: "2024-01-01T12:00:00.000Z", total: 2, assetCount: 1, status: "new", choice: "import", transactionIdCollisions: 0 },
  ];
  render(<ImportPreview rows={rows} onImport={() => {}} onCancel={() => {}} busy={false}
    locale="en" currency={{ currency: "JPY", alias: "yen", rate: 2, symbol: "¥" }} />);
  const date = (value: string) => new Intl.DateTimeFormat("en-US",
    { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
  expect(screen.getByText(date(rows[0].createdAt))).toBeInTheDocument();
  expect(screen.getByText(date(rows[1].createdAt))).toBeInTheDocument();
  expect(screen.getByText("Total ¥2.00 · 1 assets")).toBeInTheDocument();
});

it("resets choices when a fresh preview changes an imported row to Same", () => {
  const initial: ImportPreviewRow = { uuid: "one", createdAt: "2024-01-01T00:00:00Z",
    total: 5, assetCount: 1, status: "new", choice: "import", transactionIdCollisions: 0 };
  const onImport = vi.fn();
  const view = render(<ImportPreview rows={[initial]} onImport={onImport} onCancel={() => {}} busy={false} />);
  view.rerender(<ImportPreview rows={[{ ...initial, status: "same", choice: "skip" }]}
    onImport={onImport} onCancel={() => {}} busy={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Apply selected choices" }));
  expect(onImport).toHaveBeenCalledWith({ one: "skip" });
});

it("translates the expected cost price preservation failure", () => {
  render(<ImportPreview rows={[]} onImport={() => {}} onCancel={() => {}} busy={false}
    translate={(key) => (zh as Record<string, string>)[key] ?? key}
    result={{ imported: 0, replaced: 0, skipped: 0, failures: [
      { uuid: "failed-id", error: "Cannot replace snapshot without losing local cost prices" },
    ] }} />);
  expect(screen.getByRole("status")).toHaveTextContent("无法替换");
  expect(screen.getByRole("status")).not.toHaveTextContent("Cannot replace");
});

it("keeps an invalid file timestamp visible without crashing the preview", () => {
  render(<ImportPreview rows={[{ uuid: "bad-date", createdAt: "not-a-date", total: 1,
    assetCount: 1, status: "new", choice: "import", transactionIdCollisions: 0 }]}
    onImport={() => {}} onCancel={() => {}} busy={false} />);
  expect(screen.getByText("not-a-date")).toBeInTheDocument();
});
