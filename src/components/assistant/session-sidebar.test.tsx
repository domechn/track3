import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SessionSidebar from "./session-sidebar";
import type { ChatSessionMeta } from "@/middlelayers/ai";

function makeSession(overrides: Partial<ChatSessionMeta> = {}): ChatSessionMeta {
  return {
    id: "s1",
    title: "Test Session",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    pinned: 0,
    messageCount: 2,
    preview: "Hello",
    ...overrides,
  };
}

describe("SessionSidebar", () => {
  const onNew = vi.fn();
  const onSelect = vi.fn();
  const onDelete = vi.fn();
  const onPin = vi.fn();

  beforeEach(() => {
    onNew.mockReset();
    onSelect.mockReset();
    onDelete.mockReset();
    onPin.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the header with title and new-chat button", () => {
    render(
      <SessionSidebar
        sessions={[]}
        activeId={null}
        isLoading={false}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    expect(screen.getByTestId("session-sidebar")).toBeTruthy();
    expect(screen.getByTestId("session-new-chat")).toBeTruthy();
  });

  it("shows skeletons while loading", () => {
    const { container } = render(
      <SessionSidebar
        sessions={[]}
        activeId={null}
        isLoading={true}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it("shows empty message when there are no sessions", () => {
    render(
      <SessionSidebar
        sessions={[]}
        activeId={null}
        isLoading={false}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    expect(screen.getByText(/No conversations/i)).toBeTruthy();
  });

  it("renders sessions grouped by pinned and recent", () => {
    const sessions = [
      makeSession({ id: "a", title: "Pinned One", pinned: 1 }),
      makeSession({ id: "b", title: "Recent One", pinned: 0 }),
    ];
    render(
      <SessionSidebar
        sessions={sessions}
        activeId={null}
        isLoading={false}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    expect(screen.getByText("Pinned One")).toBeTruthy();
    expect(screen.getByText("Recent One")).toBeTruthy();
  });

  it("calls onNew when new-chat button is clicked", async () => {
    render(
      <SessionSidebar
        sessions={[]}
        activeId={null}
        isLoading={false}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    await userEvent.click(screen.getByTestId("session-new-chat"));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("calls onSelect when a session item is clicked", async () => {
    const sessions = [makeSession({ id: "x1" })];
    render(
      <SessionSidebar
        sessions={sessions}
        activeId={null}
        isLoading={false}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    await userEvent.click(screen.getByTestId("session-item-x1"));
    expect(onSelect).toHaveBeenCalledWith("x1");
  });

  it("highlights the active session with data-active attribute", () => {
    const sessions = [
      makeSession({ id: "a" }),
      makeSession({ id: "b" }),
    ];
    render(
      <SessionSidebar
        sessions={sessions}
        activeId="a"
        isLoading={false}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    const active = screen.getByTestId("session-item-a");
    expect(active.getAttribute("data-active")).toBe("true");
    const notActive = screen.getByTestId("session-item-b");
    expect(notActive.getAttribute("data-active")).toBeNull();
  });

  it("calls onPin when pin icon button is clicked", async () => {
    const sessions = [makeSession({ id: "p1", pinned: 0 })];
    render(
      <SessionSidebar
        sessions={sessions}
        activeId={null}
        isLoading={false}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    const pinBtn = screen.getByTestId("session-pin-p1");
    await userEvent.click(pinBtn);
    expect(onPin).toHaveBeenCalledWith("p1", true);
  });

  it("calls onPin with false for already-pinned sessions", async () => {
    const sessions = [makeSession({ id: "p2", pinned: 1 })];
    render(
      <SessionSidebar
        sessions={sessions}
        activeId={null}
        isLoading={false}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    await userEvent.click(screen.getByTestId("session-pin-p2"));
    expect(onPin).toHaveBeenCalledWith("p2", false);
  });

  it("opens delete confirmation dialog and calls onDelete when confirmed", async () => {
    const sessions = [makeSession({ id: "d1" })];
    render(
      <SessionSidebar
        sessions={sessions}
        activeId={null}
        isLoading={false}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    const delBtn = screen.getByTestId("session-delete-d1");
    await userEvent.click(delBtn);

    // The dialog should open with delete text
    expect(screen.getByText("Delete conversation?")).toBeTruthy();
    await userEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("d1");
  });

  it("cancels delete when Cancel is clicked in the dialog", async () => {
    const sessions = [makeSession({ id: "d2" })];
    render(
      <SessionSidebar
        sessions={sessions}
        activeId={null}
        isLoading={false}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    await userEvent.click(screen.getByTestId("session-delete-d2"));
    expect(screen.getByText("Delete conversation?")).toBeTruthy();
    await userEvent.click(screen.getByText("Cancel"));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("shows untitled for sessions without a title", () => {
    const sessions = [makeSession({ id: "u1", title: "" })];
    render(
      <SessionSidebar
        sessions={sessions}
        activeId={null}
        isLoading={false}
        onSelect={onSelect}
        onNew={onNew}
        onDelete={onDelete}
        onPin={onPin}
      />,
    );
    expect(screen.getByText("Untitled")).toBeTruthy();
  });
});
