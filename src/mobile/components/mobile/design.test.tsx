import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnimatedAmount, Button, DeltaPill, EmptyState, IconButton, MobileCard, MobileNavigation, Pill, SectionHeader, Switch } from "@/mobile/components/mobile";

describe("phone design components", () => {
  it("gives gain and loss amounts distinct readable labels", () => {
    render(<><DeltaPill value={3.4}>+3.4%</DeltaPill><DeltaPill value={-2.1}>−2.1%</DeltaPill></>);
    expect(screen.getByText("+3.4%")).toHaveAttribute("data-tone", "gain");
    expect(screen.getByText("−2.1%")).toHaveAttribute("data-tone", "loss");
  });

  it("honors the selected red-up quote convention", () => {
    render(<DeltaPill value={2} quoteColor="red-up-green-down">+2%</DeltaPill>);
    expect(screen.getByText("+2%")).toHaveAttribute("data-tone", "loss");
  });

  it("offers a neutral pill for non-delta labels", () => {
    render(<Pill>Core holding</Pill>);
    expect(screen.getByText("Core holding")).toHaveClass("mobile-pill");
  });

  it("offers an actionable first launch state", () => {
    const add = vi.fn();
    render(<EmptyState title="Your portfolio starts here" description="Connect a source" action="Add your first source" onAction={add} illustrationLabel="Portfolio artwork" />);
    expect(screen.getByRole("img", { name: "Portfolio artwork" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add your first source" }));
    expect(add).toHaveBeenCalledOnce();
  });

  it("keeps section and icon controls semantic", () => {
    const click = vi.fn();
    render(<><SectionHeader>Allocation</SectionHeader><MobileCard>Holdings</MobileCard><IconButton label="Refresh" onClick={click}>↻</IconButton></>);
    expect(screen.getByRole("heading", { name: "Allocation" })).toBeInTheDocument();
    expect(screen.getByText("Holdings")).toHaveClass("mobile-card");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(click).toHaveBeenCalledOnce();
  });

  it("exports a pressable primary button and an accessible switch", () => {
    const click = vi.fn();
    render(<><Button onClick={click}>Continue</Button><Switch aria-label="Notifications" /></>);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(click).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("switch", { name: "Notifications" }));
    expect(screen.getByRole("switch", { name: "Notifications" })).toHaveAttribute("aria-checked", "true");
    expect(MobileNavigation).toBeTypeOf("function");
  });

  it("shows the final amount immediately when motion is reduced", () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    try {
      render(<AnimatedAmount value={1250} format={(value) => `$${value.toFixed(2)}`} />);
      expect(screen.getByText("$1250.00")).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});
