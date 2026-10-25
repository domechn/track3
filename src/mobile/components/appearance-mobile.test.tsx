import { fireEvent, render, screen } from "@testing-library/react";
import { HashRouter, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Appearance from "@/mobile/components/appearance";
import { isIOS } from "@/utils/platform";

vi.mock("@/utils/platform", () => ({ isIOS: vi.fn(() => true) }));
vi.mock("@/middlelayers/configuration", () => ({
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
});
