import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { MobileNavigation, MobileSidebar, routeTitle, tabForPath } from "@/mobile/components/mobile/navigation";

function Path() {
  const location = useLocation();
  return <output>{location.pathname + location.search + location.hash}</output>;
}

describe("mobile navigation", () => {
  it("shows grouped routes and the unread alert on the regular-width rail", () => {
    render(<MemoryRouter initialEntries={["/goals"]}>
      <MobileSidebar unread={3} />
      <Routes><Route path="*" element={<Path />} /></Routes>
    </MemoryRouter>);
    const sidebar = document.querySelector(".mobile-sidebar")!;
    expect(sidebar).toHaveAttribute("aria-label", "Main navigation");
    expect(sidebar).toHaveTextContent("Analyze");
    expect(sidebar).toHaveTextContent("Manage");
    expect(sidebar.querySelector('a[href="/cost-basis"]')).toBeTruthy();
    const goals = sidebar.querySelector('a[href="/goals"]')!;
    expect(goals).toHaveAttribute("aria-current", "page");
    expect(goals).toHaveTextContent("3");
    expect(goals).toHaveAccessibleName("Goals & Alerts 3 unread alerts");
    fireEvent.click(sidebar.querySelector('a[href="/history"]')!);
    expect(screen.getByText("/history")).toBeInTheDocument();
  });
  it("uses an Overview link for the two-peak iPad brand", () => {
    render(<MemoryRouter initialEntries={["/history"]}>
      <MobileSidebar collapsed />
      <Routes><Route path="*" element={<Path />} /></Routes>
    </MemoryRouter>);
    const brand = screen.getByRole("link", { name: "Track3", hidden: true });
    expect(brand.querySelectorAll("polygon")).toHaveLength(2);
    fireEvent.click(brand);
    expect(screen.getByText("/overview")).toBeInTheDocument();
  });
  it("names an asset detail page for its asset", () => {
    expect(routeTitle("/coins/BTC", (key) => key)).toBe("BTC");
    expect(tabForPath("/coins/BTC")).toBe("overview");
    expect(tabForPath("/coins/BTC", true)).toBe("analytics");
  });
  it("uses the four-square overview icon in the phone rail", () => {
    render(<MemoryRouter initialEntries={["/coins/BTC"]}><MobileNavigation /></MemoryRouter>);
    const overview = screen.getByRole("link", { name: /overview/i });
    expect(overview).toHaveAttribute("aria-current", "page");
    expect(overview.querySelectorAll("svg rect")).toHaveLength(4);
  });
  it("highlights Overview for a coin detail on the iPad rail", () => {
    render(<MemoryRouter initialEntries={["/coins/BTC"]}><MobileSidebar /></MemoryRouter>);
    expect(document.querySelector('.mobile-sidebar .mobile-rail-item[href="/overview"]')).toHaveAttribute("aria-current", "page");
    expect(document.querySelectorAll(".mobile-sidebar a[aria-current='page']")).toHaveLength(1);
  });
  it("separates Settings from the iPad route groups", () => {
    render(<MemoryRouter initialEntries={["/settings"]}><MobileSidebar /></MemoryRouter>);
    const settings = document.querySelector('.mobile-sidebar a[href="/settings"]')!;
    expect(settings.parentElement).toHaveClass("t3-nav-divider");
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

  it("uses the records grid and outline history artwork", () => {
    render(<MemoryRouter initialEntries={["/history"]}><MobileNavigation /></MemoryRouter>);
    const overview = document.querySelector('.mobile-tab-bar a[href="/overview"] svg')!;
    const history = document.querySelector('.mobile-tab-bar a[href="/history"] svg')!;
    expect(overview.querySelectorAll("rect")).toHaveLength(4);
    expect(history.querySelector("circle")).toBeNull();
    expect(history.querySelector("path")).toBeTruthy();
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

  it("shows that the active Analytics tab opens more destinations", () => {
    render(<MemoryRouter initialEntries={["/summary"]}><MobileNavigation /></MemoryRouter>);
    const analytics = screen.getByRole("link", { name: "Analytics" });
    expect(analytics).toHaveAttribute("aria-description", "Tap again for Wallets, Comparison, and Cost basis");
    expect(analytics.querySelector(".mobile-analytics-disclosure")).toBeInTheDocument();
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
