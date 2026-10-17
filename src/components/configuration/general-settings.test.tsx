import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { GeneralSettings } from "./general-settings";

const baseProps = {
  groupUSD: true,
  onGroupUSDChange: vi.fn(),
  hideInactive: false,
  onHideInactiveChange: vi.fn(),
  querySize: 10,
  onQuerySizeChange: vi.fn(),
  preferCurrency: "USD",
  preferCurrencyLoading: false,
  preferCurrencyOptions: [
    { value: "USD", label: "USD - US Dollar" },
    { value: "EUR", label: "EUR - Euro" },
  ],
  preferredCurrencyDetail: undefined,
  onPreferCurrencyChange: vi.fn(),
  refreshCurrencyLoading: false,
  onUpdateCurrencyRatesClick: vi.fn(),
};

describe("GeneralSettings", () => {
  it("names each settings control and has no axe rule violations", async () => {
    const { container } = render(<GeneralSettings {...baseProps} />);
    expect(screen.getByRole("combobox", { name: "Count of Results" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Base Currency" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update currency rates" })).toBeInTheDocument();
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map(({ id }) => id)).toEqual([]);
  });
  it("renders groupUSD checkbox", () => {
    render(<GeneralSettings {...baseProps} />);

    const checkbox = screen.getByRole("checkbox", {
      name: /Group stable coins/i,
    });
    expect(checkbox).toBeInTheDocument();
  });

  it("renders hideInactive checkbox", () => {
    render(<GeneralSettings {...baseProps} />);

    const checkbox = screen.getByRole("checkbox", {
      name: /Hide inactive/i,
    });
    expect(checkbox).toBeInTheDocument();
  });

  it("shows skeleton when preferCurrencyLoading", () => {
    const { container } = render(
      <GeneralSettings {...baseProps} preferCurrencyLoading={true} />,
    );

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows exchange rate text when non-USD currency is selected", () => {
    render(
      <GeneralSettings
        {...baseProps}
        preferCurrency="EUR"
        preferredCurrencyDetail={{
          currency: "EUR",
          alias: "Euro",
          rate: 0.9,
          symbol: "EUR",
        }}
      />,
    );

    expect(screen.getByText(/1 USD =/)).toBeInTheDocument();
  });
});
