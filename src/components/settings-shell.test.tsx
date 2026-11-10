import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SettingsShell from "@/components/settings";
import Configuration from "@/components/configuration";

vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/middlelayers/license", () => ({
  isProVersion: vi.fn().mockResolvedValue({ isPro: false }),
  LicenseCenter: { getInstance: () => ({ getUsage: async () => undefined }) },
}));
vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: vi.fn().mockResolvedValue("/cache") }));
vi.mock("@/middlelayers/configuration", () => ({
  getCachedPreferCurrency: () => "USD",
  getConfiguration: async () => undefined,
  queryQuerySize: async () => 10,
  queryPreferCurrency: async () => ({ currency: "USD", rate: 1, symbol: "$" }),
  listAllCurrencyRates: async () => [],
}));

function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><span data-testid="location">{location.pathname}{location.search}</span>
    <button onClick={() => navigate(-1)}>Back</button></>;
}

function renderSettings(path: string, history = false) {
  render(<MemoryRouter initialEntries={history ? ["/overview", path] : [path]}>
    <Location />
    <Routes>
      <Route path="/overview" element={<div>Overview page</div>} />
      <Route path="/settings" element={<SettingsShell />}>
        <Route path="configuration" element={<Configuration initialPreferCurrency="USD" />} />
        <Route path="data" element={<div>Backup page</div>} />
        <Route path="appearance" element={<div>Theme page</div>} />
        <Route path="systemInfo" element={<div>Pro page</div>} />
      </Route>
    </Routes>
  </MemoryRouter>);
}

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

    expect(screen.getByRole("link", { name: "Data sources" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it.each(["/settings", "/settings/configuration"])(
    "replaces %s with the Data sources page, without the legacy combined content",
    async (path) => {
      renderSettings(path, true);
      await waitFor(() => expect(screen.getByTestId("location"))
        .toHaveTextContent("/settings/configuration?section=sources"));
      const settings = document.querySelector(".t3-settings") as HTMLElement;
      expect(settings).toHaveAttribute("data-design-section", "sources");
      const menu = within(settings).getByRole("navigation", { name: "Settings sections" });
      expect(within(menu).getAllByRole("link", { current: "page" })).toHaveLength(1);
      expect(within(menu).getByRole("link", { name: "Data sources" })).toHaveAttribute("aria-current", "page");
      expect(settings.querySelector(".t3-settings-source-tabs")).toHaveAccessibleName("Data sources");
      expect(within(settings).queryByRole("heading", { name: "Configuration" })).not.toBeInTheDocument();
      expect(within(settings).queryByText("Current quote base")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/overview"));
    }
  );

  it.each([
    ["/settings/data", "/settings/data?section=backup", "backup", "Backup & data"],
    ["/settings/appearance", "/settings/appearance?section=theme", "appearance", "Appearance"],
    ["/settings/systemInfo", "/settings/systemInfo?section=pro", "pro", "Pro & license"],
  ])("replaces bare %s with its menu page", async (path, expected, section, label) => {
    renderSettings(path, true);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(expected));
    const settings = document.querySelector(".t3-settings") as HTMLElement;
    expect(settings).toHaveAttribute("data-design-section", section);
    const menu = within(settings).getByRole("navigation", { name: "Settings sections" });
    expect(within(menu).getAllByRole("link", { current: "page" })).toHaveLength(1);
    expect(within(menu).getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/overview"));
  });
});
