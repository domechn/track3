import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SettingsShell from "@/mobile/components/settings";
import { isIOS } from "@/utils/platform";
import { vi } from "vitest";

vi.mock("@/utils/platform", () => ({ isIOS: vi.fn(() => false) }));

describe("Settings shell", () => {
  it("provides a page heading and labeled navigation", () => {
    render(
      <MemoryRouter initialEntries={["/settings/configuration"]}>
        <Routes>
          <Route path="/settings" element={<SettingsShell />}>
            <Route path="configuration" element={<div>Configuration page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /settings sections/i })).toBeInTheDocument();
  });

  it("marks the current settings section", () => {
    render(
      <MemoryRouter initialEntries={["/settings/configuration"]}>
        <Routes>
          <Route path="/settings" element={<SettingsShell />}>
            <Route path="configuration" element={<div>Configuration page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /configuration/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("opens an iPhone settings hub with reachable feature pages", () => {
    vi.mocked(isIOS).mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<SettingsShell />}>
            <Route path="configuration" element={<div>Configuration page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Data sources" })).toHaveAttribute("href", "#/settings/configuration?section=sources");
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("href", "#/settings/data?section=security");
    expect(screen.getByRole("link", { name: "Backup" })).toHaveAttribute("href", "#/settings/data?section=backup");
    expect(screen.getByRole("link", { name: "Data sources" }).querySelector(".ios-d3-settings-icon")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" }).querySelector(".ios-d3-settings-icon")).toBeInTheDocument();
    vi.mocked(isIOS).mockReturnValue(false);
  });
});
