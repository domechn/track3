import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { usePager, Pager } from "./pager";

function Example({ rows, resetKey = "BTC", initialPageSize = 25, onPageChange }: {
  rows: number[]; resetKey?: string; initialPageSize?: number; onPageChange?: () => void;
}) {
  const paging = usePager(rows, resetKey, initialPageSize, onPageChange);
  return <><output data-testid="rows">{paging.rows.join(",")}</output>
    <Pager count={rows.length} {...paging} t={(key) => ({
      "coin.fidelity.table": "Transactions", "coin.fidelity.showing": "Showing {from}-{to} of {total}",
      "coin.fidelity.previous": "Previous", "coin.fidelity.next": "Next",
      "coin.fidelity.page": "Page {page} of {pages}",
      "coin.fidelity.firstPage": "First", "coin.fidelity.lastPage": "Last",
      "coin.fidelity.pageSize": "Rows per page",
    }[key] ?? key)} labelPrefix="coin.fidelity" pageSizes={[25, 50, 100]} /></>;
}

it("remembers a chosen page size in memory across mounts", async () => {
  const user = userEvent.setup();
  const rows = Array.from({ length: 312 }, (_, i) => i + 1);
  function Remembered() {
    const paging = usePager(rows, "BTC", 25, undefined, "pager-test-session");
    return <><output>{paging.rows.length}</output><button onClick={() => paging.setPageSize(50)}>Set 50</button></>;
  }
  const view = render(<Remembered />);
  await user.click(screen.getByRole("button", { name: "Set 50" }));
  expect(screen.getByText("50")).toBeInTheDocument();
  view.unmount();
  render(<Remembered />);
  expect(screen.getByText("50")).toBeInTheDocument();
});

it.each([0, 1, 25])("hides pager for %i rows", (count) => {
  render(<Example rows={Array.from({ length: count }, (_, i) => i + 1)} />);
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  expect(screen.getByTestId("rows").textContent?.split(",").filter(Boolean)).toHaveLength(count);
});

it("pages 26 rows and resets when the key changes", async () => {
  const user = userEvent.setup();
  const rows = Array.from({ length: 26 }, (_, i) => i + 1);
  const onPageChange = vi.fn();
  const view = render(<Example rows={rows} onPageChange={onPageChange} />);
  expect(screen.getByText("Showing 1-25 of 26")).toHaveAttribute("aria-live", "polite");
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByTestId("rows")).toHaveTextContent("26");
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  view.rerender(<Example rows={rows} resetKey="ETH" onPageChange={onPageChange} />);
  expect(screen.getByText("Showing 1-25 of 26")).toBeInTheDocument();
  expect(onPageChange).toHaveBeenCalledTimes(1);
});

it("changes page size and clamps when the last page shrinks", async () => {
  const user = userEvent.setup();
  const rows = Array.from({ length: 312 }, (_, i) => i + 1);
  const onPageChange = vi.fn();
  const view = render(<Example rows={rows} onPageChange={onPageChange} />);
  expect(screen.getByText("Page 1 of 13")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Last" }));
  expect(screen.getByText("Showing 301-312 of 312")).toBeInTheDocument();
  view.rerender(<Example rows={rows.slice(0, 26)} onPageChange={onPageChange} />);
  expect(screen.getByText("Showing 26-26 of 26")).toBeInTheDocument();
  expect(onPageChange).toHaveBeenCalledTimes(1);
  await user.selectOptions(screen.getByRole("combobox", { name: "Rows per page" }), "50");
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  expect(screen.getByTestId("rows").textContent?.split(",")).toHaveLength(26);
});
