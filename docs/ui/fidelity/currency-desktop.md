# Currency & display desktop fidelity

See [Settings A shell](settings-a-shell-desktop.md). Viewed all four `currency-*-desktop.jpg` references and read the authoritative `ds/pages/settings-a-currency.html`. At 1600px, the content begins x 320, y 110. The split is 724px left, 16px gap, 512px right; cards have 20px padding. The left card is 559px high. Its settings rows are at least 76px high, with a 220px control column and 24px gap. The right column stacks a 512×309px Rates preview card and a Stablecoin grouping card with 16px gap. Section headings are 15px/20px weight 600; row titles are 13px/18px weight 600, descriptions 12px `--muted`; the 34px buttons are pill shaped.

Heading is “Currency & display” with “How values and lists look. Stored on this device.” Left card: Currency section, Base currency dropdown “USD · US dollar” and “Every total and value in the app uses this currency”; Currency rates, “Last updated today, 09:30” and Update rates button; Display section, Group USD stablecoins on with “Show USDT, USDC and similar coins as one line”; Hide inactive sources off with “Leave paused sources out of lists and charts”; History results per page dropdown 20 and “Snapshots shown per page in History.” Controls keep the existing preference handlers and persisted formats.

Rates preview header says “1 USD, today 09:30”. Columns Currency / Rate / Your total. Ordered rows: EUR Euro 0.9187 701,712; GBP British pound 0.7712 589,050; CNY Chinese yuan 7.1240 5,441,377; JPY Japanese yen 151.3200 115,579,619; HKD Hong Kong dollar 7.7701 5,934,874. Stablecoin grouping says “Group USD stablecoins is on” and “Holdings lists USDT and USDC as one line.” Rows USDT 182,446.74/$182,446.74, USDC 40,000.00/$40,000.00, total USD stablecoins/$222,446.74. Totals and currency values must come from the current real holdings and rate records.

State variants: `currency-select` opens a 220px dropdown aligned with the base currency control, options USD, EUR, GBP, CNY, JPY, HKD in order, USD checked. `currency-updating` changes the rate button to disabled “Updating…” with spinner, description to “Fetching the latest rates…”, right header to “updating…”, and five skeleton rows; stablecoin card stays. `currency-rates-error` says “Couldn’t reach the rates service. Showing the rates from 30 Oct, 09:30.” in red plus neutral; the preview header says “from 30 Oct” in amber and retains prior rates. Retry uses Update rates. No new data field or storage is allowed.

## Remaining differences

**9 Nov 2026 layout audit:** currency 6.658% at 1280 × 800, dark, against the rendered source HTML (RGB channel difference sum > 60). The dense CNY fixture and working product state differ from the static reference; the page-specific visible differences are listed below.

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

The capture table records current ratios at a 24/255 maximum RGB channel threshold. The preview uses actual stored balances and currency rates.

## Capture results

| State | Pixel difference | App capture |
| --- | ---: | --- |
| `currency-default` | 2.88% | `/tmp/fidelity-desktop/currency/currency-default-desktop.png` |
| `currency-select` | 2.89% | `/tmp/fidelity-desktop/currency/currency-select-desktop.png` |
| `currency-updating` | 2.08% | `/tmp/fidelity-desktop/currency/currency-updating-desktop.png` |
| `currency-rates-error` | 2.95% | `/tmp/fidelity-desktop/currency/currency-rates-error-desktop.png` |
