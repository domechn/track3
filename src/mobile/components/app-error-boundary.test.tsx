import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { I18nProvider } from "@/mobile/i18n";
import AppErrorBoundary from "@/mobile/components/app-error-boundary";
import { reportIOSFrontendError } from "@/utils/ios-ready";
import { getVersion } from "@/utils/app";

vi.mock("@/utils/ios-ready", () => ({ reportIOSFrontendError: vi.fn() }));
vi.mock("@/utils/app", () => ({ getVersion: vi.fn().mockResolvedValue("0.9.5") }));

function BrokenPage(): React.JSX.Element {
  throw new Error("page render failed");
}

it("shows a localized recovery screen when the app crashes during render", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(
      <I18nProvider>
        <AppErrorBoundary>
          <BrokenPage />
        </AppErrorBoundary>
      </I18nProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Track3 could not open this page.");
    expect(reportIOSFrontendError).toHaveBeenCalledWith(expect.stringMatching(/^page render failed\nError:/));
  } finally {
    vi.restoreAllMocks();
  }
});

it("shows a redacted stack, app version, and occurrence time in the copyable details", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  function BrokenWithStack(): React.JSX.Element {
    const error = new Error("page render failed");
    error.stack = "Error: page render failed\n    at BrokenWithStack (overview.tsx:12:3)";
    throw error;
  }
  try {
    render(<I18nProvider><AppErrorBoundary><BrokenWithStack /></AppErrorBoundary></I18nProvider>);
    expect(screen.getByText(/at BrokenWithStack/)).toBeInTheDocument();
    expect(await screen.findByText(/Track3 0\.9\.5/)).toBeInTheDocument();
    expect(screen.getByText(/\d{2}:\d{2}:\d{2} UTC/)).toBeInTheDocument();
    expect(getVersion).toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});
