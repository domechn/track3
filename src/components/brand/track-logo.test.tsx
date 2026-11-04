import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TrackLogo } from "./track-logo";

it("draws the two peaks with theme tokens and an accessible name", () => {
  render(<TrackLogo size={32} />);
  const logo = screen.getByRole("img", { name: "Track3" });
  expect(logo).toHaveAttribute("width", "32");
  expect(logo).toHaveAttribute("height", "32");
  expect(logo.querySelectorAll("polygon")).toHaveLength(2);
  expect(logo.querySelectorAll("polygon")[0]).toHaveAttribute("fill", "hsl(var(--accent-data))");
  expect(logo.querySelectorAll("polygon")[1]).toHaveAttribute("fill", "hsl(var(--foreground))");
});

it("hides the mark from assistive technology beside the visible wordmark", () => {
  render(<><TrackLogo decorative /><span>Track3</span></>);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(document.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});

it("keeps the app icon peaks' proportions", () => {
  render(<TrackLogo />);
  const points = [...document.querySelectorAll("svg polygon")]
    .flatMap((polygon) => polygon.getAttribute("points")!.split(" "))
    .map((pair) => pair.split(",").map(Number));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const ratio = (Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs));
  expect(ratio).toBeCloseTo(283 / 410, 2);
});
