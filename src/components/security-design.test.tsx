import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SecurityDesign } from "./security-design";

vi.mock("@/components/settings/sync-recovery", () => ({ SyncRecoveryExport: () => null }));

it("shows stored secret categories and opens key rotation", () => {
  render(<SecurityDesign syncReady encKeyInput="" setEncKeyInput={vi.fn()} encKeyConfirm=""
    setEncKeyConfirm={vi.fn()} encKeySaving={false} keyRotated={false}
    secretInventory={{ exchanges: ["Binance"], brokers: [], assistant: "openrouter.ai" }} onRotate={vi.fn()} />);
  expect(screen.getByText("Binance")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Rotate encryption key/ }));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
});
