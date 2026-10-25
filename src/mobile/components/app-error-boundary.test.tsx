import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { I18nProvider } from "@/mobile/i18n";
import AppErrorBoundary from "@/mobile/components/app-error-boundary";
import { reportIOSFrontendError } from "@/utils/ios-ready";

vi.mock("@/utils/ios-ready", () => ({ reportIOSFrontendError: vi.fn() }));

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
    expect(screen.getByRole("alert")).toHaveTextContent("Track3 could not open this page.");
    expect(reportIOSFrontendError).toHaveBeenCalledWith(expect.stringMatching(/^page render failed\nError:/));
  } finally {
    vi.restoreAllMocks();
  }
});
