import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";

export type SafeArea = { top: number; right: number; bottom: number; left: number };
export type Platform = {
  isIOS: boolean;
  isMobile: boolean;
  safeArea: SafeArea;
  keyboardHeight: number;
  keyboardOpen: boolean;
};

export function detectPlatform(userAgent: string, platform: string, touchPoints: number) {
  const isIOS = /iPhone|iPad|iPod/.test(userAgent) ||
    (platform === "MacIntel" && touchPoints > 1);
  return { isIOS, isMobile: isIOS };
}

export function keyboardHeight(windowHeight: number, viewportHeight: number, offsetTop: number) {
  return Math.max(0, Math.round(windowHeight - viewportHeight - offsetTop));
}

export function isIOS() {
  return typeof navigator !== "undefined" &&
    detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints).isIOS;
}

function readSafeArea(): SafeArea {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

function snapshot(): Platform {
  if (typeof window === "undefined") {
    return { isIOS: false, isMobile: false, safeArea: { top: 0, right: 0, bottom: 0, left: 0 }, keyboardHeight: 0, keyboardOpen: false };
  }
  const detected = detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  const viewport = window.visualViewport;
  const height = viewport ? keyboardHeight(window.innerHeight, viewport.height, viewport.offsetTop) : 0;
  return {
    ...detected,
    safeArea: readSafeArea(),
    keyboardHeight: height,
    keyboardOpen: height > 100,
  };
}

const fallbackPlatform: Platform = {
  ...(typeof navigator === "undefined"
    ? { isIOS: false, isMobile: false }
    : detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)),
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  keyboardHeight: 0,
  keyboardOpen: false,
};

const PlatformContext = createContext<Platform | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatform] = useState(snapshot);
  useEffect(() => {
    const update = () => setPlatform(snapshot());
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);
  return createElement(PlatformContext.Provider, { value: platform }, children);
}

export function usePlatform(): Platform {
  return useContext(PlatformContext) ?? fallbackPlatform;
}
