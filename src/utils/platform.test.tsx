import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformProvider, detectPlatform, keyboardHeight, usePlatform } from "./platform";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("iOS platform state", () => {
  it("recognizes iPhone and touch iPad without treating desktop Safari as iOS", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", "iPhone", 0).isIOS).toBe(true);
    expect(detectPlatform("Mozilla/5.0 (Macintosh)", "MacIntel", 5).isIOS).toBe(true);
    expect(detectPlatform("Mozilla/5.0 (Macintosh)", "MacIntel", 0).isIOS).toBe(false);
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0)", "Win32", 0).isMobile).toBe(false);
  });

  it("reads platform state without a DOM probe when no provider is mounted", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const createElement = vi.spyOn(document, "createElement");
    function ReadPlatform() {
      const { isMobile } = usePlatform();
      return <output>{String(isMobile)}</output>;
    }
    render(<ReadPlatform />, { container });
    expect(screen.getByText("false")).toBeInTheDocument();
    expect(createElement).not.toHaveBeenCalledWith("div");
  });

  it("reports visible keyboard overlap without negative heights", () => {
    expect(keyboardHeight(800, 500, 0)).toBe(300);
    expect(keyboardHeight(800, 810, 0)).toBe(0);
  });

  it("updates keyboard overlap on visual viewport resize and exposes safe area insets", () => {
    const viewport = Object.assign(new EventTarget(), { height: window.innerHeight, offsetTop: 0 });
    const oldViewport = window.visualViewport;
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    const realGetComputedStyle = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (element instanceof HTMLDivElement && element.style.visibility === "hidden") {
        return {
          paddingTop: "47px",
          paddingRight: "0px",
          paddingBottom: "34px",
          paddingLeft: "0px",
        } as CSSStyleDeclaration;
      }
      return realGetComputedStyle(element);
    });
    function ReadPlatform() {
      const { safeArea, keyboardHeight, keyboardOpen } = usePlatform();
      return <output>{`${safeArea.top}/${safeArea.bottom}/${keyboardHeight}/${keyboardOpen}`}</output>;
    }

    try {
      render(<PlatformProvider><ReadPlatform /></PlatformProvider>);
      expect(screen.getByText("47/34/0/false")).toBeInTheDocument();

      viewport.height = window.innerHeight - 300;
      act(() => viewport.dispatchEvent(new Event("resize")));
      expect(screen.getByText("47/34/300/true")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "visualViewport", { configurable: true, value: oldViewport });
    }
  });
});
