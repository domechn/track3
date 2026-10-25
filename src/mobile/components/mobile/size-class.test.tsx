import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSizeClass } from "@/mobile/components/mobile/size-class";

function Probe() {
  const size = useSizeClass();
  return <output>{`${size.width}:${size.height}`}</output>;
}

describe("useSizeClass", () => {
  it("updates from compact to regular to wide and back as the window resizes", () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    try {
      Object.defineProperties(window, {
        innerWidth: { configurable: true, value: 375 },
        innerHeight: { configurable: true, value: 667 },
      });
      render(<Probe />);
      expect(screen.getByRole("status")).toHaveTextContent("compact:regular");
      for (const [width, height, expected] of [
        [744, 1133, "regular:regular"],
        [1032, 430, "wide:compact"],
        [507, 1024, "compact:regular"],
      ] as const) {
        Object.defineProperties(window, {
          innerWidth: { configurable: true, value: width },
          innerHeight: { configurable: true, value: height },
        });
        act(() => window.dispatchEvent(new Event("resize")));
        expect(screen.getByRole("status")).toHaveTextContent(expected);
      }
    } finally {
      Object.defineProperties(window, {
        innerWidth: { configurable: true, value: originalWidth },
        innerHeight: { configurable: true, value: originalHeight },
      });
      act(() => window.dispatchEvent(new Event("resize")));
    }
  });
});
