import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SettingsShell from "@/components/settings";

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
});
