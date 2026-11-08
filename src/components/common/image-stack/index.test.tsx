import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import ImageStack from ".";

it("uses the shared tiles for snapshot logo previews", () => {
  const { container } = render(<ImageStack imageSrcs={["/btc.png", ""]} symbols={["BTC", "NOVA"]} imageWidth={18} imageHeight={18} />);
  expect(container.querySelectorAll(".image-stack .t3-asset-icon[data-size='20']")).toHaveLength(2);
  expect(container.querySelector(".t3-asset-icon-fallback")).toHaveAttribute("data-initials", "N");
});
