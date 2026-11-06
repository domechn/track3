import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { openUrl } from "@tauri-apps/plugin-opener";
import ReleaseNotes from "./release-notes";
import notes096 from "./release-notes.fixture.md?raw";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));

beforeEach(() => vi.clearAllMocks());

it("renders the 0.9.6 notes as sections, a callout, numbered and bulleted lists, and inline formatting", () => {
  const { container } = render(<ReleaseNotes content={notes096} />);
  expect(screen.getByRole("heading", { name: "🎉 Features" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Known issues" })).toBeVisible();
  expect(container.querySelector("blockquote")).toHaveTextContent("No database or storage-format changes in 0.9.6.");
  expect(container.querySelector("blockquote strong")).toHaveTextContent("No database or storage-format changes");
  expect(container.querySelector("ol")?.querySelectorAll(":scope > li")).toHaveLength(3);
  expect(container.querySelector("ul")?.querySelectorAll(":scope > li")).toHaveLength(5);
  expect(container.querySelector("code")).toHaveTextContent("docs/ui/fidelity/");
  expect(screen.getByText("Full Changelog", { exact: false })).toBeVisible();
  expect(container.textContent).not.toContain("# 🎉");
  expect(container.textContent).not.toContain("**Every");
});

it("keeps old heading and bullet notes readable", () => {
  const { container } = render(<ReleaseNotes content={"## New\n- First fix\n* Second fix\n\nNext line\nsoft line\n\n---\n### More\n_italic_"} />);
  expect(screen.getByRole("heading", { name: "New" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "More" })).toBeVisible();
  expect(container.querySelectorAll("ul > li")).toHaveLength(2);
  expect(container.querySelector("p")?.textContent).toContain("Next line\nsoft line");
  expect(container.querySelector("hr")).toBeInTheDocument();
  expect(container.querySelector("em")).toHaveTextContent("italic");
});

it("separates compact plain headings from the preceding bullets", () => {
  const { container } = render(<ReleaseNotes content={"New\n- First fix\n- Second fix\nImproved\n- Faster refresh\nFixed\n- Stable history"} />);
  for (const heading of ["New", "Improved", "Fixed"]) {
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  }
  expect(container.querySelectorAll("li")).toHaveLength(4);
  expect(container.querySelector("li")?.textContent).not.toContain("Improved");
});

it("opens only safe http links in the system browser and shortens bare URL labels", () => {
  render(<ReleaseNotes content={"[Website](https://track3.dev/notes)\n\nhttps://github.com/domechn/track3/compare/app-v0.9.5...app-v0.9.6"} />);
  fireEvent.click(screen.getByRole("link", { name: "Website" }));
  expect(openUrl).toHaveBeenCalledWith("https://track3.dev/notes");
  const changelog = screen.getByRole("link", { name: /github\.com/ });
  expect(changelog).not.toHaveAttribute("href");
  expect(changelog.textContent).not.toContain("https://");
  expect(changelog.textContent?.length).toBeLessThan(55);
  expect(changelog).toHaveTextContent("app-v0.9.6");
  fireEvent.click(changelog);
  expect(openUrl).toHaveBeenCalledWith("https://github.com/domechn/track3/compare/app-v0.9.5...app-v0.9.6");
});

it("reports when the system browser cannot open a release link", async () => {
  vi.mocked(openUrl).mockRejectedValueOnce(new Error("opener unavailable"));
  render(<ReleaseNotes content="[Release page](https://track3.dev/notes)" />);
  fireEvent.click(screen.getByRole("link", { name: "Release page" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not open the release link.");
});

it("ignores raw HTML and leaves unsafe links as plain text", () => {
  const { container } = render(<ReleaseNotes content={'<script>alert("bad")</script>\n<img src=x onerror="alert(1)">\n\n[x](javascript:alert(1)) [data](data:text/html;base64,PHNjcmlwdD4=)'} />);
  expect(container.querySelector("script, img, a")).not.toBeInTheDocument();
  expect(screen.getByText("x", { exact: true })).toBeVisible();
  expect(screen.getByText("data", { exact: true })).toBeVisible();
  expect(openUrl).not.toHaveBeenCalled();
});

it("renders one level of nested ordered and unordered items", () => {
  const { container } = render(<ReleaseNotes content={"1. Parent\n   - Child\n2. Next"} />);
  expect(container.querySelector("ol > li > ul > li")).toHaveTextContent("Child");
  expect(container.querySelector("ol")?.querySelectorAll(":scope > li")).toHaveLength(2);
});

it("uses the translated release-notes label for the scrollable region", () => {
  render(<ReleaseNotes content="## New" />);
  expect(screen.getByRole("region", { name: "Full release notes" })).toBeVisible();
});
