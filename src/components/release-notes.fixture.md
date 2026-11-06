See the assets to download this version and install.

> **No database or storage-format changes in 0.9.6.** Nothing is migrated on upgrade, and sync, export and backup formats are unchanged. This release is the user interface (every page), one Profit Summary fix and one telemetry fix. A backup is still always a good idea (Settings → Data Management → Export).

# 🎉 Features

1. **Every page now follows the approved dark design.** Summary, coin detail pages, History (and its detail), Cost basis, Rebalance, Goals & alerts, Overview, Wallets, Comparison, the Assistant, all Settings pages, the first-run guide, refresh, startup and update screens, toasts and dialogs were rebuilt against the design on both desktop and iPhone/iPad. The layout, order, spacing and copy of each screen were measured against the design page; the remaining differences are written down in `docs/ui/fidelity/`.
2. **Profit Summary no longer blanks a whole month.** If a month contains a withdrawal that is not matched with a deposit, the profit of that coin is unknown. Before, one such coin turned the whole month into a bare dash. Now the month shows the profit of the coins that are known, marked with an info icon that lists the coins that are not included and why. The header counts those months as partial.
3. **Cost basis "Data gaps".** The data gaps are now a table (date, coin, amount, reason) instead of one long list of sentences, and dust and floating-point residue (for example `1.4e-17 ETH`) is folded into a single line. Amounts are formatted consistently.

# 👍 Optimization

1. Analytics: builds used for automated testing no longer send usage events, so test runs no longer show up as new users.
2. Light and dark themes, the gain/loss (red-up or green-up) setting and accessibility (focus, 44 px touch targets, reduced motion) are checked on every redesigned screen.
3. The sync status, refresh and source popovers, toasts and dialogs look and behave the same on every page and at every window width.

# Known issues

- The design's Rebalance page shows sample data with eight suggested trades. The app calculates the real trades from your data and the tolerance, so your page will usually be shorter.
- A few visual details differ from the design by small amounts (typography and spacing under 3% of pixels); they are listed in the docs above.
- The design has screens the app cannot show (the desktop app lock, lock timeout, monthly restore points, removing devices remotely): the real behaviour is shown instead.
- The redesign was checked with automated tests and screenshots, not on every device. Please tell us if anything looks off.
- Importing a file whose transaction IDs collide with different local transactions can overwrite them (unchanged since 0.9.4; the import preview warns when it detects colliding IDs).

macOS builds are ad-hoc signed and **not notarized**: on first launch open **System Settings → Privacy & Security → Open Anyway** (or right-click → Open).

**Full Changelog**: https://github.com/domechn/track3/compare/app-v0.9.5...app-v0.9.6
