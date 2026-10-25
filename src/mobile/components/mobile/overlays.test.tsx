import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ConfirmSheet, ModalPage } from "@/mobile/components/mobile/overlays";

it("keeps page focus inside, closes on Escape, and restores scrolling", () => {
  const dismiss = vi.fn();
  const before = document.body.style.overflow;
  const view = render(<><button>Outside</button><ModalPage title="Edit" onDismiss={dismiss}>
    <button>First</button><button>Last</button>
  </ModalPage></>);
  expect(document.body.style.overflow).toBe("hidden");
  expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(dismiss).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(document.body.style.overflow).toBe(before);
});

it("dismisses a sheet when its backdrop is tapped", () => {
  const dismiss = vi.fn();
  render(<ConfirmSheet title="Delete" onDismiss={dismiss}><button>Cancel</button></ConfirmSheet>);
  fireEvent.click(screen.getByRole("alertdialog"));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

it("mounts full-screen overlays at the document root", () => {
  render(<div><ModalPage title="Edit" onDismiss={() => {}}>Edit form</ModalPage>
    <ConfirmSheet title="Delete" onDismiss={() => {}}>Delete form</ConfirmSheet></div>);
  expect(screen.getByRole("dialog", { name: "Edit" }).parentElement).toBe(document.body);
  expect(screen.getByRole("alertdialog", { name: "Delete" }).parentElement).toBe(document.body);
});
