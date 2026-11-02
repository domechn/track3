import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { getVersion } from "@/utils/app";
import { SettingsMenu } from "./settings-menu";

vi.mock("@/utils/app", () => ({
  getVersion: vi.fn().mockResolvedValue("0.9.5"),
}));

describe("Settings menu", () => {
  it("keeps the established routes while exposing focused sections and the running version", async () => {
    render(<MemoryRouter initialEntries={["/settings/configuration"]}>
      <SettingsMenu pathname="/settings/configuration" search="" />
    </MemoryRouter>);

    const menu = screen.getByRole("navigation", { name: "Settings sections" });
    expect(within(menu).getByRole("link", { name: "Data sources" })).toHaveAttribute("href", "/settings/configuration?section=sources");
    expect(within(menu).getByRole("link", { name: "Currency & display" })).toHaveAttribute("href", "/settings/configuration?section=currency");
    expect(within(menu).getByRole("link", { name: "Backup & sync" })).toHaveAttribute("href", "/settings/sync");
    expect(await within(menu).findByRole("link", { name: /About.*0\.9\.5/ })).toHaveAttribute("href", "/settings/systemInfo?section=about");
  });

  it("shows the running app version in About", async () => {
    vi.mocked(getVersion).mockResolvedValueOnce("9.8.7");
    render(<MemoryRouter><SettingsMenu pathname="/settings" search="" /></MemoryRouter>);
    expect((await screen.findByText("9.8.7")).closest("a")).toHaveAccessibleName("About 9.8.7");
  });

  it("shows the current iPhone currency, language, and appearance values", () => {
    render(<MemoryRouter><SettingsMenu pathname="/settings" search=""
      values={{ currency: "JPY", language: "English", appearance: "Dark" }} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Currency & display" })).toHaveTextContent("JPY");
    expect(screen.getByRole("link", { name: "Currency & display" })).toHaveAccessibleDescription("JPY");
    expect(screen.getByRole("link", { name: "Language" })).toHaveTextContent("English");
    expect(screen.getByRole("link", { name: "Appearance" })).toHaveTextContent("Dark");
  });

  it.each([
    ["/settings/data", "Backup & data"],
    ["/settings/appearance", "Appearance"],
    ["/settings/systemInfo", "Pro & license"],
  ])("highlights the default section on %s", (pathname, label) => {
    render(<MemoryRouter><SettingsMenu pathname={pathname} search="" /></MemoryRouter>);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  });
});
