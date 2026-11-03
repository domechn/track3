import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SettingsMenu } from "@/components/settings/settings-menu";

describe("phone settings menu", () => {
  it("shows real status labels and design icons without changing routes", () => {
    render(<MemoryRouter><SettingsMenu pathname="/settings" search="" mobileFidelity
      values={{ blacklist: "3 hidden", currency: "USD", pro: "Pro", ai: "On", sync: "On" }} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Blacklist" })).toHaveTextContent("3 hidden");
    expect(screen.getByRole("link", { name: "Pro & license" })).toHaveTextContent("Pro");
    expect(screen.getByRole("link", { name: "AI assistant" })).toHaveTextContent("On");
    expect(screen.getByRole("link", { name: "Backup & sync" })).toHaveTextContent("On");
    expect(screen.getByRole("link", { name: "Data sources" })).toHaveAttribute("href", "/settings/configuration?section=sources");
    expect(screen.getByTestId("settings-menu-icon-sources")).toBeVisible();
  });
});
