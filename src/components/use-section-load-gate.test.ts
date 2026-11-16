import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useSectionLoadGate } from "./use-section-load-gate";

const mount = (expected: number, resetKey = "a", enabled = true) => renderHook(
  (props: { expected: number; resetKey: string; enabled: boolean }) =>
    useSectionLoadGate(props.expected, props.resetKey, props.enabled),
  { initialProps: { expected, resetKey, enabled } },
);

it("opens at exactly the expected number of reports", () => {
  const gate = mount(3);
  expect(gate.result.current).toMatchObject({ loading: true, state: "loading" });

  act(() => gate.result.current.reportLoaded());
  act(() => gate.result.current.reportLoaded());
  expect(gate.result.current).toMatchObject({ loading: true, state: "loading" });

  act(() => gate.result.current.reportLoaded());
  expect(gate.result.current).toMatchObject({ loading: false, state: "loaded" });
});

it("ignores reports beyond the expected number", () => {
  const gate = mount(1);
  act(() => gate.result.current.reportLoaded());
  act(() => gate.result.current.reportLoaded());
  act(() => gate.result.current.reportLoaded());
  expect(gate.result.current.loading).toBe(false);
});

it("closes again and counts from zero when the reset key changes", () => {
  const gate = mount(2);
  act(() => gate.result.current.reportLoaded());
  act(() => gate.result.current.reportLoaded());
  expect(gate.result.current.loading).toBe(false);

  gate.rerender({ expected: 2, resetKey: "b", enabled: true });
  expect(gate.result.current.loading).toBe(true);
  act(() => gate.result.current.reportLoaded());
  expect(gate.result.current.loading).toBe(true);
  act(() => gate.result.current.reportLoaded());
  expect(gate.result.current.loading).toBe(false);
});

it("does not reset on a rerender with the same key", () => {
  const gate = mount(1);
  act(() => gate.result.current.reportLoaded());
  gate.rerender({ expected: 1, resetKey: "a", enabled: true });
  expect(gate.result.current.loading).toBe(false);
});

it("returns stable callbacks", () => {
  const gate = mount(2);
  const { reportLoaded, markLoaded } = gate.result.current;
  act(() => reportLoaded());
  gate.rerender({ expected: 2, resetKey: "b", enabled: true });
  expect(gate.result.current.reportLoaded).toBe(reportLoaded);
  expect(gate.result.current.markLoaded).toBe(markLoaded);
});

it("opens at once through markLoaded and closes on the next reset", () => {
  const gate = mount(5);
  act(() => gate.result.current.markLoaded());
  expect(gate.result.current.loading).toBe(false);
  gate.rerender({ expected: 5, resetKey: "b", enabled: true });
  expect(gate.result.current.loading).toBe(true);
});

it("stays open while disabled and closes when enabled again", () => {
  const gate = mount(2, "a", false);
  expect(gate.result.current).toMatchObject({ loading: false, state: "loaded" });
  gate.rerender({ expected: 2, resetKey: "a", enabled: true });
  expect(gate.result.current.loading).toBe(true);
});
