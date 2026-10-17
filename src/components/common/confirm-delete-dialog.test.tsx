import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConfirmDeleteDialog from "./confirm-delete-dialog";

function Fixture() {
  const parentClick = vi.fn();
  const confirm = vi.fn();
  return { parentClick, confirm, view: (
    <div onClick={parentClick}>
      <ConfirmDeleteDialog
        trigger={<button aria-label="Remove record">×</button>}
        title="Delete record?"
        description="This removes the selected record."
        cancelLabel="Cancel"
        actions={[{ label: "Delete", onClick: confirm }]}
      />
    </div>
  ) };
}

describe("ConfirmDeleteDialog", () => {
  it("keeps trigger, backdrop, cancel, and confirm clicks out of the parent", () => {
    const { view, parentClick, confirm } = Fixture();
    render(view);
    fireEvent.click(screen.getByRole("button", { name: "Remove record" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete record?" });
    expect(dialog).toHaveAccessibleDescription("This removes the selected record.");
    expect(parentClick).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector("div.fixed.inset-0:not([role])")!);
    expect(parentClick).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(parentClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove record" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("closes with Escape without confirming or activating a parent key handler", () => {
    const onKeyDown = vi.fn();
    const { view, confirm } = Fixture();
    render(<div onKeyDown={onKeyDown}>{view}</div>);
    fireEvent.click(screen.getByRole("button", { name: "Remove record" }));
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it("keeps trigger keyboard activation out of a parent row", () => {
    const onKeyDown = vi.fn();
    const { view } = Fixture();
    render(<div onKeyDown={onKeyDown}>{view}</div>);
    fireEvent.keyDown(screen.getByRole("button", { name: "Remove record" }), { key: "Enter" });
    expect(onKeyDown).not.toHaveBeenCalled();
  });
});
