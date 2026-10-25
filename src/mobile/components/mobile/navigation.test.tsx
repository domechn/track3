import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { MobileNavigation, MobileSidebar, routeTitle } from "@/mobile/components/mobile/navigation";

function Path() {
  const location = useLocation();
  return <output>{location.pathname + location.search + location.hash}</output>;
}

describe("mobile navigation", () => {
  it("uses the same roots and alert badge in the sidebar", () => {
    render(<MemoryRouter initialEntries={["/goals"]}>
      <MobileSidebar unread={3} />
      <Routes><Route path="*" element={<Path />} /></Routes>
    </MemoryRouter>);
    const sidebar = document.querySelector(".mobile-sidebar")!;
    expect(sidebar).toHaveAttribute("aria-label", "Tabs");
    const more = sidebar.querySelector('a[href="/more"]')!;
    expect(more).toHaveAttribute("aria-current", "page");
    expect(more).toHaveTextContent("3");
    expect(more).toHaveAccessibleName("More, 3 unread alerts");
    fireEvent.click(sidebar.querySelector('a[href="/history"]')!);
    expect(screen.getByText("/history")).toBeInTheDocument();
  });
  it("names an asset detail page for its asset", () => {
    expect(routeTitle("/coins/BTC", (key) => key)).toBe("BTC");
  });
  it("shows four tabs and opens each tab at its root", () => {
    render(<MemoryRouter initialEntries={["/cost-basis"]}>
      <MobileNavigation unread={2} />
      <Routes><Route path="*" element={<Path />} /></Routes>
    </MemoryRouter>);
    const tabs = screen.getAllByRole("link", { name: /overview|history|analytics|more/i, hidden: true });
    expect(tabs).toHaveLength(4);
    expect(screen.getByRole("link", { name: /analytics/i, hidden: true })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("link", { name: /history/i, hidden: true }));
    expect(screen.getByText("/history")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /analytics/i, hidden: true }));
    expect(screen.getByText("/summary")).toBeInTheDocument();
  });

  it("does not retain a stock detail query when returning to Analytics", () => {
    render(<MemoryRouter initialEntries={["/coins/AAPL?assetType=stock"]}>
      <MobileNavigation />
      <Routes><Route path="*" element={<Path />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: /history/i, hidden: true }));
    fireEvent.click(screen.getByRole("link", { name: /analytics/i, hidden: true }));
    expect(screen.getByText("/summary")).toBeInTheDocument();
  });

  it.each(["?range=7d", "#details"])("clears an active tab's %s when tapping its root", (suffix) => {
    render(<MemoryRouter initialEntries={[`/overview${suffix}`]}>
      <MobileNavigation />
      <Routes><Route path="*" element={<Path />} /></Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: /overview/i, hidden: true }));
    expect(screen.getByText("/overview")).toBeInTheDocument();
  });
});
