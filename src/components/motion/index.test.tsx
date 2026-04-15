import { describe, expect, it } from "vitest";
import {
  fadeUpVariants,
  getAccessibleMotionProps,
  staggerContainerVariants,
} from "@/components/motion";

describe("getAccessibleMotionProps", () => {
  it("disables motion props when reduced motion is preferred", () => {
    expect(
      getAccessibleMotionProps(true, {
        variants: staggerContainerVariants,
        initial: "hidden",
        animate: "show",
      })
    ).toEqual({});
  });

  it("preserves motion props when reduced motion is not preferred", () => {
    expect(
      getAccessibleMotionProps(false, {
        variants: fadeUpVariants,
        initial: "hidden",
        animate: "show",
      })
    ).toEqual({
      variants: fadeUpVariants,
      initial: "hidden",
      animate: "show",
    });
  });
});
