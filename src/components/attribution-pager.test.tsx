import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { AttributionPager, useAttributionPage } from "./attribution-pager";

it("shows 20 rows per page and reaches remaining rows through the shared pager", async () => {
  const rows = Array.from({ length: 25 }, (_, index) => `Rule ${index + 1}`);
  function Example() {
    const paging = useAttributionPage(rows, "rules", 20);
    return <><ul>{paging.rows.map((row) => <li key={row}>{row}</li>)}</ul>
      <AttributionPager count={rows.length} {...paging} t={(key) => key} ariaLabel="Rules" /></>;
  }
  render(<Example />);
  expect(screen.getByRole("navigation", { name: "Rules" })).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(20);
  expect(screen.queryByText("Rule 25")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "profit.attribution.next" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
  expect(screen.getByText("Rule 25")).toBeInTheDocument();
});
