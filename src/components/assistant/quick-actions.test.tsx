import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuickActions, { QUICK_ACTION_KEYS, quickActionPrompt } from "./quick-actions";

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "assistant.chat.quickActions.label": "Quick Actions",
        "assistant.chat.quickActions.recentAnalysis": "Recent Analysis",
        "assistant.chat.quickActions.recentOperations": "Recent Operations",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("QuickActions", () => {
  const onRun = vi.fn();

  beforeEach(() => {
    onRun.mockReset();
  });

  it("renders both action buttons with labels", () => {
    render(<QuickActions onRun={onRun} />);
    expect(screen.getByTestId("quick-action-analysis")).toBeTruthy();
    expect(screen.getByTestId("quick-action-operations")).toBeTruthy();
    expect(screen.getByText("Quick Actions")).toBeTruthy();
  });

  it("calls onRun with the correct key when Analysis button is clicked", async () => {
    render(<QuickActions onRun={onRun} />);
    await userEvent.click(screen.getByTestId("quick-action-analysis"));
    expect(onRun).toHaveBeenCalledWith(QUICK_ACTION_KEYS.recentAnalysis);
  });

  it("calls onRun with the correct key when Operations button is clicked", async () => {
    render(<QuickActions onRun={onRun} />);
    await userEvent.click(screen.getByTestId("quick-action-operations"));
    expect(onRun).toHaveBeenCalledWith(QUICK_ACTION_KEYS.recentOperations);
  });

  it("disables buttons when disabled prop is true", () => {
    render(<QuickActions onRun={onRun} disabled />);
    const analysisBtn = screen.getByTestId("quick-action-analysis");
    const operationsBtn = screen.getByTestId("quick-action-operations");
    expect((analysisBtn as HTMLButtonElement).disabled).toBe(true);
    expect((operationsBtn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("quickActionPrompt", () => {
  it("returns a non-empty prompt for recentAnalysis", () => {
    const prompt = quickActionPrompt(QUICK_ACTION_KEYS.recentAnalysis);
    expect(prompt.length).toBeGreaterThan(10);
    expect(prompt).toContain("portfolio");
  });

  it("returns a non-empty prompt for recentOperations", () => {
    const prompt = quickActionPrompt(QUICK_ACTION_KEYS.recentOperations);
    expect(prompt.length).toBeGreaterThan(10);
    expect(prompt).toContain("transactions");
  });
});
