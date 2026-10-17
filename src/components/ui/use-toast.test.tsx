import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { toast, useToast } from "./use-toast";

it("redacts secret-looking strings before keeping a toast in UI state", () => {
  const { result } = renderHook(() => useToast());
  act(() => { toast({ description: "API failed: sk-abcdefghijklmnop1234567890" }); });
  expect(String(result.current.toasts[0]?.description)).not.toContain("sk-abcdefghijklmnop1234567890");
});
