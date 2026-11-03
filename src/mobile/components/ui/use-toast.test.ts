import { describe, expect, it } from "vitest";
import { reducer } from "./use-toast";

describe("mobile toast stack", () => {
  it("keeps the two most recent notices visible", () => {
    const first = reducer({ toasts: [] }, { type: "ADD_TOAST", toast: { id: "1", title: "Failed" } });
    const second = reducer(first, { type: "ADD_TOAST", toast: { id: "2", title: "Deleted" } });
    expect(second.toasts.map((toast) => toast.title)).toEqual(["Deleted", "Failed"]);
  });
});
