import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HashRouter, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Appearance from "@/mobile/components/appearance";
import { ThemeProvider } from "@/mobile/components/common/theme";
import { isIOS } from "@/utils/platform";
import { reloadApp } from "@/utils/app";

vi.mock("@/utils/platform", () => ({ isIOS: vi.fn(() => true) }));
vi.mock("@/middlelayers/configuration", () => ({
  themeLocalStorageKey: "track3-ui-theme",
  getQuoteColor: vi.fn().mockResolvedValue("green-up-red-down"),
  saveQuoteColor: vi.fn(),
  saveTheme: vi.fn(),
}));
vi.mock("@/utils/app", () => ({ reloadApp: vi.fn() }));

describe("iPhone appearance settings", () => {
  function NavigateToLanguage() {
    const navigate = useNavigate();
    return <button onClick={() => navigate("/settings/appearance?section=language")}>Open language</button>;
  }
  it("keeps language selection separate from theme and offers system theme", () => {
    window.location.hash = "#/settings/appearance?section=theme";
    const view = render(<HashRouter><Appearance /></HashRouter>);
    expect(screen.getByText("Follow system")).toBeInTheDocument();
    expect(screen.queryByText("Language")).not.toBeInTheDocument();
    view.unmount();
    window.location.hash = "#/settings/appearance?section=language";
    render(<HashRouter><Appearance /></HashRouter>);
    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.queryByText("Follow system")).not.toBeInTheDocument();
    vi.mocked(isIOS).mockReturnValue(false);
    window.location.hash = "";
  });

  it("updates the visible section when the route query changes", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/appearance?section=theme";
    render(<HashRouter><NavigateToLanguage /><Appearance /></HashRouter>);
    expect(screen.queryByText("Language")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open language" }));
    expect(await screen.findByText("Language")).toBeInTheDocument();
    vi.mocked(isIOS).mockReturnValue(false);
    window.location.hash = "";
  });

  it("keeps the desktop theme choices unchanged", () => {
    vi.mocked(isIOS).mockReturnValue(false);
    window.location.hash = "#/settings/appearance";
    render(<HashRouter><Appearance /></HashRouter>);
    expect(screen.queryByText("Follow system")).not.toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    vi.mocked(isIOS).mockReturnValue(true);
  });

  it("switches the iPhone theme in place without a process relaunch", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    vi.mocked(reloadApp).mockClear();
    localStorage.setItem("track3-ui-theme", "light");
    window.location.hash = "#/settings/appearance?section=theme";
    try {
      render(<HashRouter><ThemeProvider><Appearance /></ThemeProvider></HashRouter>);
      fireEvent.click(screen.getByRole("button", { name: "Dark" }));
      await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
      expect(reloadApp).not.toHaveBeenCalled();
    } finally {
      localStorage.removeItem("track3-ui-theme");
    }
  });

  it("shows the three theme choices with visual previews", () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/appearance?section=theme";
    render(<HashRouter><Appearance /></HashRouter>);
    expect(screen.getAllByTestId("theme-preview")).toHaveLength(3);
    expect(screen.getAllByTestId("theme-preview")[0]).toHaveClass("t3-theme-preview-light");
  });

  it("applies a theme without invoking the desktop process plugin", async () => {
    vi.mocked(isIOS).mockReturnValue(false);
    vi.mocked(reloadApp).mockClear();
    localStorage.setItem("track3-ui-theme", "light");
    window.location.hash = "#/settings/appearance";
    try {
      render(<HashRouter><ThemeProvider><Appearance /></ThemeProvider></HashRouter>);
      fireEvent.click(screen.getByText("Dark"));
      fireEvent.click(screen.getByRole("button", { name: "Update Preferences" }));
      await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
      expect(reloadApp).not.toHaveBeenCalled();
    } finally {
      vi.mocked(isIOS).mockReturnValue(true);
      localStorage.removeItem("track3-ui-theme");
    }
  });
});
