import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionSheet, BottomSheet, MobileRecordList, PullToRefresh, SegmentedControl, SwipeableRow } from "@/mobile/components/mobile";

describe("mobile interactions", () => {
  it("dismisses a sheet with Escape and restores focus", async () => {
    const onOpenChange = vi.fn();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const view = render(
      <BottomSheet open onOpenChange={onOpenChange} title="Details">
        <button>Inside</button>
      </BottomSheet>,
    );
    expect(screen.getByRole("dialog", { name: "Details" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    view.rerender(<BottomSheet open={false} onOpenChange={onOpenChange} title="Details" />);
    await waitFor(() => expect(trigger).toHaveFocus());
    trigger.remove();
  });

  it("offers a swipe action as an accessible button", () => {
    const onDelete = vi.fn();
    render(<SwipeableRow actions={[{ label: "Delete", onClick: onDelete, destructive: true }]}>Snapshot</SwipeableRow>);
    const row = screen.getByText("Snapshot").closest("[data-swipeable-row]");
    expect(row).not.toBeNull();
    fireEvent.pointerDown(row!, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(row!, { clientX: 120, clientY: 102, pointerId: 1 });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("keeps a concealed swipe action out of keyboard navigation", () => {
    render(<SwipeableRow actions={[{ label: "Delete", onClick: () => {} }]}>Snapshot</SwipeableRow>);
    const row = screen.getByText("Snapshot").closest("[data-swipeable-row]")!;
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(row.querySelector("button")).toHaveAttribute("tabindex", "-1");
    fireEvent.pointerDown(row, { clientX: 200, clientY: 100 });
    fireEvent.pointerCancel(row, { clientX: 120, clientY: 102 });
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(row.querySelector("button")).toHaveAttribute("tabindex", "0");
  });

  it("does not open a row detail when a swipe ends with a click", () => {
    const open = vi.fn();
    render(<SwipeableRow actions={[{ label: "Delete", onClick: () => {} }]}>
      <button onClick={open}>Snapshot</button>
    </SwipeableRow>);
    const row = screen.getByText("Snapshot").closest("[data-swipeable-row]")!;
    fireEvent.pointerDown(row, { clientX: 200, clientY: 100 });
    fireEvent.pointerUp(row, { clientX: 120, clientY: 102 });
    fireEvent.click(screen.getByRole("button", { name: "Snapshot" }));
    expect(open).not.toHaveBeenCalled();
  });

  it("selects one segment and exposes its selected state", () => {
    const onChange = vi.fn();
    render(<SegmentedControl value="week" onChange={onChange} options={[
      { value: "day", label: "Day" }, { value: "week", label: "Week" },
    ]} />);
    expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    expect(onChange).toHaveBeenCalledWith("day");
  });

  it("gives selection feedback when a touch segment changes", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    render(<SegmentedControl value="day" onChange={() => {}} options={[
      { value: "day", label: "Day" }, { value: "week", label: "Week" },
    ]} />);
    fireEvent.click(screen.getByRole("radio", { name: "Week" }));
    expect(vibrate).toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "vibrate");
  });

  it("refreshes on a downward gesture only when scrolled to the top", () => {
    const onRefresh = vi.fn();
    const { getByTestId } = render(<PullToRefresh onRefresh={onRefresh}><div>Content</div></PullToRefresh>);
    const area = getByTestId("pull-to-refresh");
    fireEvent.touchStart(area, { touches: [{ clientX: 100, clientY: 20 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 102, clientY: 110 }] });
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("does not refresh when a touch starts inside a scrolled inner container", () => {
    const onRefresh = vi.fn();
    render(<PullToRefresh onRefresh={onRefresh}>
      <div data-testid="inner-scroll" style={{ overflowY: "auto" }}><span>Older messages</span></div>
    </PullToRefresh>);
    const inner = screen.getByTestId("inner-scroll");
    Object.defineProperties(inner, {
      scrollHeight: { configurable: true, value: 240 },
      clientHeight: { configurable: true, value: 80 },
    });
    inner.scrollTop = 50;
    const target = screen.getByText("Older messages");
    fireEvent.touchStart(target, { touches: [{ clientX: 100, clientY: 20 }] });
    fireEvent.touchMove(target, { touches: [{ clientX: 100, clientY: 100 }] });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 100, clientY: 100 }] });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("does not refresh when a drag starts inside a portal sheet", () => {
    const onRefresh = vi.fn();
    render(<PullToRefresh onRefresh={onRefresh}>
      <BottomSheet open onOpenChange={() => {}} title="Dates">
        <div>Snapshot dates</div>
      </BottomSheet>
    </PullToRefresh>);
    const sheet = screen.getByRole("dialog", { name: "Dates" });
    fireEvent.touchStart(sheet, { touches: [{ clientX: 100, clientY: 20 }], changedTouches: [{ clientX: 100, clientY: 20 }] });
    fireEvent.touchMove(sheet, { touches: [{ clientX: 100, clientY: 120 }], changedTouches: [{ clientX: 100, clientY: 120 }] });
    fireEvent.touchEnd(sheet, { touches: [{ clientX: 100, clientY: 120 }], changedTouches: [{ clientX: 100, clientY: 120 }] });
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("lets the sheet handle track a drag before changing detents", () => {
    render(<BottomSheet open onOpenChange={() => {}} title="Details">
      <div>Content</div>
    </BottomSheet>);
    const sheet = screen.getByRole("dialog", { name: "Details" });
    const handle = sheet.querySelector(".mobile-sheet-handle-area")!;
    fireEvent.pointerDown(handle, { clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 200, pointerId: 1 });
    expect(sheet).toHaveStyle({ height: "calc(min(60dvh, 42rem) + 100px)" });
    fireEvent.pointerUp(handle, { clientY: 200, pointerId: 1 });
    expect(sheet).toHaveClass("mobile-sheet-large");
    fireEvent.pointerDown(handle, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 250, pointerId: 1 });
    expect(sheet).toHaveStyle({ height: "calc(100dvh - env(safe-area-inset-top) - .5rem - 50px)" });
    fireEvent.pointerUp(handle, { clientY: 300, pointerId: 1 });
    expect(sheet).toHaveClass("mobile-sheet-medium");
  });

  it("closes an action sheet after choosing an action", () => {
    const onOpenChange = vi.fn();
    const onChoose = vi.fn();
    render(<ActionSheet open onOpenChange={onOpenChange} title="Options" actions={[
      { label: "Open", onClick: onChoose },
    ]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onChoose).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens record fields in a detail sheet", () => {
    render(<MobileRecordList records={[{
      id: "btc", title: "BTC", subtitle: "$42,000", fields: [
        { label: "Cost basis", value: "$40,000" },
      ],
    }]} />);
    fireEvent.click(screen.getByRole("button", { name: /BTC/ }));
    const dialog = screen.getByRole("dialog", { name: "BTC" });
    expect(dialog).toHaveTextContent("Cost basis");
    expect(dialog).toHaveTextContent("$40,000");
  });

  it("raises a form sheet above the virtual keyboard", () => {
    const oldViewport = window.visualViewport;
    Object.defineProperty(window, "visualViewport", { configurable: true, value: {
      height: 500, offsetTop: 0, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } });
    try {
      render(<BottomSheet open onOpenChange={() => {}} title="Form"><input aria-label="Name" /></BottomSheet>);
      expect(screen.getByRole("dialog", { name: "Form" })).toHaveStyle({ bottom: `${window.innerHeight - 500}px` });
    } finally {
      Object.defineProperty(window, "visualViewport", { configurable: true, value: oldViewport });
    }
  });
});
