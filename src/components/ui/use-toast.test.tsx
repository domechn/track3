import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { toast, useToast } from "./use-toast";

it("redacts secret-looking strings before keeping a toast in UI state", () => {
  const { result } = renderHook(() => useToast());
  act(() => { toast({ description: "API failed: sk-abcdefghijklmnop1234567890" }); });
  expect(String(result.current.toasts[0]?.description)).not.toContain("sk-abcdefghijklmnop1234567890");
});

it("keeps the three latest notices visible on a wide desktop", () => {
  const previousWidth = window.innerWidth;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1600 });
  try {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "First" });
      toast({ title: "Second" });
      toast({ title: "Third" });
    });
    expect(result.current.toasts.slice(-3).map((item) => item.title)).toEqual(["First", "Second", "Third"]);
  } finally {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
  }
});

it("keeps three notices throughout desktop widths", () => {
  const previousWidth = window.innerWidth;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
  try {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "First" });
      toast({ title: "Second" });
      toast({ title: "Third" });
    });
    expect(result.current.toasts.slice(-3).map((item) => item.title)).toEqual(["First", "Second", "Third"]);
  } finally {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
  }
});

it("gives product notices a visible tone even when callers omit it", () => {
  const previousWidth = window.innerWidth;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1600 });
  try {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "Saved" });
      toast({ title: "Failed", variant: "destructive" });
    });
    expect(result.current.toasts.at(-1)?.tone).toBe("error");
    expect(result.current.toasts.at(-2)?.tone).toBe("info");
  } finally {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
  }
});
