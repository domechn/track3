import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TrackLogo } from "./track-logo";

it("draws the two rounded blue peaks with an accessible name", () => {
  render(<TrackLogo size={32} />);
  const logo = screen.getByRole("img", { name: "Track3" });
  expect(logo).toHaveAttribute("width", "32");
  expect(logo).toHaveAttribute("height", "32");
  expect(logo.querySelectorAll("polygon")).toHaveLength(2);
  expect(logo.querySelectorAll("polygon")[0]).toHaveAttribute("fill", "hsl(var(--accent-data))");
  expect(logo.querySelectorAll("polygon")[1]).toHaveAttribute("fill", "hsl(var(--track-logo-tint))");
  for (const peak of logo.querySelectorAll("polygon")) {
    expect(peak).toHaveAttribute("stroke-linejoin", "round");
  }
});

it("hides the mark from assistive technology beside the visible wordmark", () => {
  render(<><TrackLogo decorative /><span>Track3</span></>);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(document.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});

it("keeps the tall left peak dominant, aligned, and large enough for small icons", () => {
  render(<TrackLogo />);
  const peaks = [...document.querySelectorAll("svg polygon")].map((polygon) =>
    polygon.getAttribute("points")!.split(" ").map((pair) => pair.split(",").map(Number)));
  const xs = peaks.flatMap((peak) => peak.map(([x]) => x));
  const ys = peaks.flatMap((peak) => peak.map(([, y]) => y));
  const stroke = Number(document.querySelector("svg polygon")!.getAttribute("stroke-width"));
  expect((Math.max(...xs) - Math.min(...xs) + stroke) / 28).toBeGreaterThanOrEqual(0.75);
  expect((Math.max(...xs) - Math.min(...xs) + stroke) / 28).toBeLessThanOrEqual(0.79);
  expect(Math.min(...peaks[0].map(([, y]) => y))).toBeLessThan(Math.min(...peaks[1].map(([, y]) => y)));
  expect(peaks[0][0][1]).toBe(peaks[1][0][1]);
  expect(Math.max(...ys)).toBeLessThan(23);
});
