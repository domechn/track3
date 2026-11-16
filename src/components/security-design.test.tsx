import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

// Mirrors the page binding: saving goes true then false around every attempt, the banner flag is set only on success.
function RotationHarness({ rotated = false, rotate }: { rotated?: boolean; rotate: () => Promise<boolean> }) {
  const [saving, setSaving] = useState(false);
  const [keyRotated, setKeyRotated] = useState(rotated);
  return <SecurityDesign syncReady encKeyInput="" setEncKeyInput={vi.fn()} encKeyConfirm="" setEncKeyConfirm={vi.fn()}
    encKeySaving={saving} keyRotated={keyRotated} customKey={false} onReset={vi.fn()}
    onRotate={async () => {
      setSaving(true);
      const ok = await rotate();
      if (ok) setKeyRotated(true);
      setSaving(false);
      return ok;
    }} />;
}

function startRotation(rotated = false) {
  let finish!: (ok: boolean) => void;
  render(<RotationHarness rotated={rotated} rotate={() => new Promise<boolean>((resolve) => { finish = resolve; })} />);
  fireEvent.click(screen.getByRole("button", { name: /Rotate encryption key/ }));
  const action = within(screen.getByRole("alertdialog")).getByRole("button", { name: "Rotate key" });
  fireEvent.click(action);
  return { action, finish: (ok: boolean) => act(async () => { finish(ok); }) };
}

it("disables the rotation action while saving and closes the dialog after success", async () => {
  const { action, finish } = startRotation();
  expect(action).toBeDisabled();
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  await finish(true);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

it("keeps the rotation dialog open when the first rotation fails", async () => {
  const { action, finish } = startRotation();
  await finish(false);
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(action).toBeEnabled();
});

it("keeps the rotation dialog open when a rotation fails after an earlier success", async () => {
  const { finish } = startRotation(true);
  await finish(false);
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
});
