import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SecurityDesign } from "./security-design";

vi.mock("@/components/settings/sync-recovery", () => ({ SyncRecoveryExport: () => null }));

it("shows stored secret categories and opens key rotation", () => {
  render(<SecurityDesign syncReady encKeyInput="" setEncKeyInput={vi.fn()} encKeyConfirm=""
    setEncKeyConfirm={vi.fn()} encKeySaving={false} keyRotated={false}
    customKey={false} onReset={vi.fn()}
    secretInventory={{ exchanges: ["Binance"], brokers: [], assistant: "openrouter.ai" }} onRotate={vi.fn()} />);
  expect(screen.getByText("Binance")).toBeInTheDocument();
  expect(screen.getByText("Default key")).toBeInTheDocument();
  expect(screen.getByText(/Default key is shared by all Track3 installs/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Rotate encryption key/ }));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(screen.getByText(/Losing it makes encrypted data unrecoverable/)).toBeInTheDocument();
});

it("shows a custom-key badge and allows removal after confirmation", () => {
  const onReset = vi.fn();
  render(<SecurityDesign syncReady encKeyInput="" setEncKeyInput={vi.fn()} encKeyConfirm=""
    setEncKeyConfirm={vi.fn()} encKeySaving={false} keyRotated={false}
    customKey onReset={onReset} onRotate={vi.fn()} />);
  expect(screen.getByText("Custom key")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove custom key" }));
  expect(onReset).toHaveBeenCalledOnce();
});
