# Rollback of 0.9.10 visuals

Baseline: `app-v0.9.9`; source: `origin/master` (`e4a7c2a0`). Every path changed from the baseline to master is classified below. `both` means its 0.9.9 presentation was restored and the named behavior was reapplied, except for the updater dialog and its eight scoped CSS rules from #862. All `visual` paths match the baseline. The alias action in source rows is the other necessary UI exception.

| Change | Path | Kind | Result | Reason |
|---|---|---|---|---|
| A | `docs/profit-calculation.md` | data | keep behavior | additive P&L explanation |
| M | `docs/ui/fidelity/about-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/about-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/appearance-default-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/appearance-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/assistant-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/assistant-new-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/backup-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/backup-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/batch-1-phone-review.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/blacklist-default-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/blacklist-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/coin-btc-edit-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/coin-btc-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/coin-btc-price-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/coin-btc-sheet-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/coin-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/coin-ipad.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/coin-nova-edit-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/coin-nova-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/coin-nvda-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/comparison-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/comparison-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/cost-basis-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/cost-basis-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/currency-default-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/currency-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/goals-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/goals-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/history-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/history-detail-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/history-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/language-default-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/language-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| A | `docs/ui/fidelity/navigation.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/overview-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/overview-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/overview-sync-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/pro-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/pro-expired-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/pro-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/rebalance-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/rebalance-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/refresh-partial-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/refresh-progress-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/refresh-progress-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/refresh-states-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sources-brokers-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sources-custom-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sources-default-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sources-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sources-empty-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sources-wallets-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/startup-syncunlock-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/summary-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/summary-empty-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/summary-ipad.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/summary-loading-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/summary-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sync-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sync-locked-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sync-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sync-pop-error-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sync-pop-locked-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sync-pop-never-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sync-pop-ok-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sync-pop-stopped-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/sync-pop-syncing-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/wallets-all-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/wallets-binance-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/wallets-desktop.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `docs/ui/fidelity/wallets-okx-phone.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| A | `docs/ui/icon-style.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| A | `docs/ui/layout-rules.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| A | `docs/ui/navigation.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| A | `docs/ui/shell-theme-sweep.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| A | `docs/ui/theme-tokens.md` | visual | revert to 0.9.9 | documentation of reverted appearance |
| M | `package.json` | data | keep behavior | 0.9.10 version metadata; Rust source is unchanged |
| A | `scripts/theme-raw-colors-guard.mjs` | visual | revert to 0.9.9 | layout guard or audit helper |
| A | `scripts/theme-raw-colors-guard.test.mjs` | visual | revert to 0.9.9 | layout guard or audit helper |
| M | `src-tauri/Cargo.lock` | data | keep behavior | 0.9.10 version metadata; Rust source is unchanged |
| M | `src-tauri/Cargo.toml` | data | keep behavior | 0.9.10 version metadata; Rust source is unchanged |
| M | `src-tauri/gen/apple/project.yml` | data | keep behavior | 0.9.10 version metadata; Rust source is unchanged |
| M | `src-tauri/gen/apple/track3.xcodeproj/project.pbxproj` | data | keep behavior | 0.9.10 version metadata; Rust source is unchanged |
| M | `src-tauri/tauri.conf.json` | data | keep behavior | 0.9.10 version metadata; Rust source is unchanged |
| M | `src/components/about-design.test.tsx` | both | keep behavior | 0.9.9 visual tests plus docs link and guarded About download checks |
| M | `src/components/about-design.tsx` | both | keep behavior | About downloads use the guarded updater flow; docs links stay fixed |
| M | `src/components/analyze-values.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/analyze-values.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/appearance.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/assistant/action-card.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/assistant/chat-page.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/assistant/chat-page.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/assistant/chat-thread.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/assistant/session-sidebar.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/ath-value.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/auto-backup-indicator.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/components/auto-updater-stall.test.tsx` | data | keep behavior | updater timeout, retry, progress, cancel, and error regressions from #862 |
| A | `src/components/auto-updater-state.test.ts` | data | keep behavior | updater state transitions from #862 |
| A | `src/components/auto-updater-state.ts` | data | keep behavior | bounded updater progress and failure state from #862 |
| M | `src/components/auto-updater.test.tsx` | both | keep behavior | updater progress, retry, and manual download checks |
| M | `src/components/auto-updater.tsx` | both | keep behavior | updater stall handling, progress, retry, and manual download from #862 |
| M | `src/components/backup-design.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/backup-restore-list.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/components/chart-theme-tooltip.test.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/chart-tooltip-placement.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/chart-tooltip.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/coin-analytics.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/coin-analytics.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/coin-detail-sections.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/coin-detail-sections.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/coin-fidelity-view.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/coin-fidelity-view.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/common/asset-label.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/common/asset-label.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/common/image-stack/index.css` | visual | revert to 0.9.9 | 0.9.10 styling or visual asset |
| A | `src/components/common/image-stack/index.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/common/image-stack/index.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/components/common/signed-inline-text.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/common/signed-inline-text.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/comparison-fidelity.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/comparison-fidelity.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/comparison-movers-panel.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/comparison-movers-panel.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/comparison-page.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/comparison.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/components/configuration/alias-rename.test.tsx` | data | keep behavior | alias persistence and current source identity |
| A | `src/components/configuration/alias-rename.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/attach-modal.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/configuration/exchange-section.test.tsx` | data | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/exchange-section.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/index.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/others-section.test.tsx` | data | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/others-section.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/public-ip-info.tsx` | data | keep behavior | working external documentation or release link |
| M | `src/components/configuration/quick-look-dialog.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/components/configuration/rename-save.test.tsx` | data | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/source-design.test.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/source-design.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/source-editor-design.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/configuration/source-editor-design.tsx` | both | keep behavior | working external documentation or release link |
| M | `src/components/configuration/stock-broker-section.test.tsx` | data | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/stock-broker-section.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/summary-cards.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/configuration/types.ts` | data | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/wallet-section.test.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/configuration/wallet-section.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/cost-basis-desktop-view.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/cost-basis-panels.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/cost-basis-panels.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/cost-basis.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/daily-change-tooltip.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/data-management.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/date-picker-design.test.tsx` | both | keep behavior | one-day Summary range regression retained |
| M | `src/components/empty-state.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/fidelity-data.test.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/fidelity-data.ts` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/fidelity-rail.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/fidelity-rail.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/finance-charts.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/finance-charts.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/first-run-overview.css` | visual | revert to 0.9.9 | 0.9.10 styling or visual asset |
| M | `src/components/fitting-attribution-amount.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/goals-alerts.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/goals-alerts.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/goals-desktop.css` | visual | revert to 0.9.9 | 0.9.10 styling or visual asset |
| M | `src/components/goals-desktop.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/goals-desktop.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/historical-data-desktop.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/historical-data-desktop.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/historical-data.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/history-partial.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/import-preview.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/index/index-coin-data-changed.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/index/index-data-changed.test.tsx` | both | keep behavior | source alias save publishes data change |
| M | `src/components/index/index.tsx` | both | keep behavior | Summary range selection and preceding snapshot baseline |
| M | `src/components/insights-card.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/insights-card.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/latest-assets-percentage.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/latest-assets-percentage.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/onboarding/onboarding-guide.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/onboarding/onboarding.css` | visual | revert to 0.9.9 | 0.9.10 styling or visual asset |
| A | `src/components/overlay-theme-tokens.test.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/overview-chart-scale.test.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/overview-chart-scale.ts` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/components/overview-chart-tooltip.test.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/overview-chart-tooltip.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/overview-derived.test.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/overview-derived.ts` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/overview-panels.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/overview-panels.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/overview-semantic-controls.test.tsx` | both | keep behavior | chart contribution sign regression retained |
| M | `src/components/overview-shared-boundary.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/overview-source-fidelity.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/overview-sync-fidelity.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/overview-top-mover.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/overview-top-mover.ts` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/overview.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/page-wrapper.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/partial-overview.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/pnl-chart.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/pro-design.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/pro-license-devices.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/profit-attribution.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/profit-attribution.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/profit-loading.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/profit-summary-boundary.test.tsx` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/profit-summary-hints.test.tsx` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/profit-summary-hints.tsx` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/profit-summary-mover-query.test.tsx` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/profit-summary.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/profit.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/range-sensitive-queries.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/realtime-total-value.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/rebalance-desktop.css` | visual | revert to 0.9.9 | 0.9.10 styling or visual asset |
| M | `src/components/rebalance-desktop.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/rebalance-desktop.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/rebalance.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/rebalance.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/refresh-data.test.tsx` | both | keep behavior | current source alias and provider identity regressions retained |
| M | `src/components/refresh-data.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/refresh-duplicate-fetch.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/refresh-source-name.ts` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/security-design.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/settings/assistant-design.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/settings/index.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/settings/settings-menu.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/settings/sync.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/sidebar/index.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/sidebar/index.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/components/sidebar/navigation-style.test.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/signed-money.test.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/signed-money.ts` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/source-allocation-list.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/source-display-name.test.ts` | data | keep behavior | alias persistence and current source identity |
| M | `src/components/source-display-name.ts` | data | keep behavior | alias persistence and current source identity |
| A | `src/components/source-run-progress.test.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/source-run-progress.ts` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/source-status-match.test.ts` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/source-status-match.ts` | both | keep behavior | alias persistence and current source identity |
| M | `src/components/summary-fidelity-range-context.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/summary-market-card.test.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/summary-market-card.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/summary-profit-loss.test.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/summary-profit-loss.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/summary-top-list.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/summary-top-list.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/summary.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/components/sync-details.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/sync-details.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/sync-status-indicator-states.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/sync-status-indicator-wide.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/sync-status-indicator.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/system-info-card.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/system-info-card.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/system-info-subscription.test.tsx` | both | keep behavior | About update checks use a bounded timeout |
| M | `src/components/system-info.tsx` | both | keep behavior | About update checks use a bounded timeout |
| M | `src/components/top-coins-percentage-change.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/top-coins-percentage-change.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/top-coins-rank.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/total-value-and-change.tsx` | both | keep behavior | correct sign of chart contribution content |
| M | `src/components/ui/alert-dialog.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/components/ui/asset-icon.css` | visual | revert to 0.9.9 | 0.9.10 styling or visual asset |
| A | `src/components/ui/asset-icon.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/ui/asset-icon.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/ui/button-group.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/ui/calendar.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/ui/checkbox.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/ui/dialog.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/ui/pager.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/ui/pagination.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/components/ui/tag.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/components/ui/tag.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/components/use-current-source-statuses.test.tsx` | data | keep behavior | alias persistence and current source identity |
| A | `src/components/use-current-source-statuses.ts` | data | keep behavior | alias persistence and current source identity |
| M | `src/components/wallet-analytics.tsx` | data | keep behavior | alias persistence and current source identity |
| M | `src/components/wallet-assets-change.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/wallet-assets-percentage.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/wallet-assets-percentage.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/components/wallet-source-changes.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/wallet-source-changes.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/components/wallets-fidelity.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/components/wallets-fidelity.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/i18n/locales/en.json` | both | keep behavior | retained behavior and #862 updater copy; five legacy 0.9.9 keys remain |
| M | `src/i18n/locales/zh.json` | both | keep behavior | retained behavior and #862 updater copy; five legacy 0.9.9 keys remain |
| A | `src/i18n/summary-net-catalog.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| A | `src/lib/external-links.test.ts` | both | keep behavior | published links and caller-owned error toast regression |
| A | `src/lib/external-links.ts` | both | keep behavior | published links, download URL, and caller-owned error toast behavior |
| M | `src/middlelayers/ai/skills/asset-detail.test.ts` | data | keep behavior | alias persistence and current source identity |
| M | `src/middlelayers/ai/skills/asset-detail.ts` | data | keep behavior | alias persistence and current source identity |
| A | `src/middlelayers/ai/skills/transaction-list.test.ts` | data | keep behavior | alias persistence and current source identity |
| M | `src/middlelayers/ai/skills/transaction-list.ts` | data | keep behavior | alias persistence and current source identity |
| M | `src/middlelayers/cache-invalidation.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-asset-type.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| A | `src/middlelayers/charts-assets-range.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-assets.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-attribution-data.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-attribution-data.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-attribution.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-attribution.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-blacklist.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| A | `src/middlelayers/charts-interval-profit.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| A | `src/middlelayers/charts-interval-profit.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-profit-cache-persistence.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-profit-numeric.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-profit-test-fixtures.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-profit.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-profit.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/charts-refresh-sell.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/middlelayers/constants.ts` | data | keep behavior | working external documentation or release link |
| M | `src/middlelayers/entities/assets.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| A | `src/middlelayers/source-status-labels.test.ts` | data | keep behavior | alias persistence and current source identity |
| A | `src/middlelayers/source-status-labels.ts` | data | keep behavior | alias persistence and current source identity |
| M | `src/middlelayers/source-status.test.ts` | data | keep behavior | alias persistence and current source identity |
| A | `src/middlelayers/summary-breakdown.test.ts` | data | keep behavior | Summary range selection and preceding snapshot baseline |
| A | `src/middlelayers/summary-breakdown.ts` | data | keep behavior | Summary range selection and preceding snapshot baseline |
| A | `src/middlelayers/summary-range.test.ts` | data | keep behavior | Summary range selection and preceding snapshot baseline |
| A | `src/middlelayers/summary-range.ts` | data | keep behavior | Summary range selection and preceding snapshot baseline |
| M | `src/middlelayers/ui-state/source-status-store.test.ts` | data | keep behavior | alias persistence and current source identity |
| M | `src/middlelayers/ui-state/source-status-store.ts` | data | keep behavior | alias persistence and current source identity |
| M | `src/middlelayers/wallet.test.ts` | data | keep behavior | alias persistence and current source identity |
| M | `src/mobile/components/appearance-mobile.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/appearance.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/assistant/chat-page.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/assistant/chat-thread.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/assistant/message-bubble.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/assistant/phone-action-card.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/assistant/session-sidebar.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/auto-backup-indicator.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/coin-analytics.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/coin-analytics.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/mobile/components/coin-fidelity.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/mobile/components/coin-metric-fit.test.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `src/mobile/components/coin-metric-fit.ts` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/comparison-fidelity.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/comparison-page.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/comparison.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/configuration-base-currency.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/configuration/attach-modal.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/configuration/fidelity-source-editor.tsx` | both | keep behavior | working external documentation or release link |
| M | `src/mobile/components/configuration/index.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/mobile/components/configuration/mobile-others.test.tsx` | data | keep behavior | alias persistence and current source identity |
| M | `src/mobile/components/configuration/mobile-others.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/mobile/components/configuration/mobile-sources.test.tsx` | data | keep behavior | alias persistence and current source identity |
| M | `src/mobile/components/configuration/mobile-sources.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/mobile/components/configuration/quick-look-dialog.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/cost-basis-phone.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/cost-basis.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/cost-basis.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/data-management.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/finance-charts.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/finance-charts.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/first-run-fidelity.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/goals-alerts.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/goals-fidelity.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/goals-fidelity.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/historical-data.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/historical-data.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/index/index-coin-data-changed.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/index/index-data-changed.test.tsx` | both | keep behavior | phone source alias save publishes data change |
| M | `src/mobile/components/index/index.tsx` | both | keep behavior | Summary range selection and preceding snapshot baseline |
| M | `src/mobile/components/insights-card.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/latest-assets-percentage.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/mobile/design.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/mobile/design.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/mobile/fidelity.css` | visual | revert to 0.9.9 | 0.9.10 styling or visual asset |
| M | `src/mobile/components/mobile/index.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/mobile/mobile.css` | visual | revert to 0.9.9 | 0.9.10 styling or visual asset |
| M | `src/mobile/components/mobile/mobile.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/mobile/navigation.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/mobile/navigation.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/mobile/overlays.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/overview-fidelity.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/overview.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/mobile/components/partial-overview-fidelity.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/partial-overview-fidelity.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/plan-fidelity.css` | visual | revert to 0.9.9 | 0.9.10 styling or visual asset |
| M | `src/mobile/components/pnl-chart-theme.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/pnl-chart.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/profit-attribution.test.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/mobile/components/profit-attribution.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/mobile/components/profit-loading.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/profit-summary-year.test.tsx` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/mobile/components/profit-summary.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/mobile/components/profit.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/mobile/components/range-sensitive-queries.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/rebalance-fidelity.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/rebalance-fidelity.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/rebalance.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/rebalance.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/refresh-data.test.tsx` | both | keep behavior | pending refresh uses current wallet alias |
| M | `src/mobile/components/refresh-data.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/mobile/components/settings-shell.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/settings/assistant.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/settings/sync.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| D | `src/mobile/components/source-mark.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| D | `src/mobile/components/source-mark.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/mobile/components/summary-fidelity-tooltip.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/summary-fidelity.tsx` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/mobile/components/summary.tsx` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/mobile/components/system-info-subscription.test.tsx` | both | keep behavior | iPhone About documentation link regression retained |
| M | `src/mobile/components/system-info.tsx` | both | keep behavior | working external documentation or release link |
| A | `src/mobile/components/top-coins-percentage-change.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/top-coins-percentage-change.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/top-coins-rank.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/total-value-and-change.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/ui/alert-dialog.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/ui/dialog.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/wallet-assets-change.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `src/mobile/components/wallet-assets-percentage.test.tsx` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/mobile/components/wallet-assets-percentage.tsx` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| A | `src/mobile/components/wallet-fidelity.test.tsx` | data | keep behavior | failed exchange and broker statuses retain real identities |
| M | `src/mobile/components/wallet-fidelity.tsx` | both | keep behavior | alias persistence and current source identity |
| M | `src/mobile/en.json` | both | keep behavior | copy for retained profit, range, alias, or link behavior |
| M | `src/mobile/ios-style.css` | visual | revert to 0.9.9 | 0.9.10 styling or visual asset |
| M | `src/mobile/zh.json` | both | keep behavior | copy for retained profit, range, alias, or link behavior |
| M | `src/style.css` | both | keep behavior | eight updater-only rules from #862; explicit I1 exception |
| M | `src/test/eval/golden.test.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `src/test/skills/update-release.test.ts` | data | keep behavior | two-digit patch ordering regression retained |
| A | `src/test/theme-raw-colors-guard.test.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `src/utils/chart-theme.ts` | visual | revert to 0.9.9 | 0.9.10 presentation or layout |
| M | `tests/e2e/accessibility.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ai-setup.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/analyze-attribution.spec.ts` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `tests/e2e/attribution-layout.spec.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `tests/e2e/card-padding-captures.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/card-row-heights.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/chart-tooltip-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/chart-tooltip-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/coin-layout-balance.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/coin-layout-law-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/coin-layout-law.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/custom-price.spec.ts` | both | keep behavior | alias persistence and current source identity |
| M | `tests/e2e/density.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-bridge-captures.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-coin-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-coin.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-comparison-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-comparison.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-cost-basis-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-desktop-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-flows.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-goals-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-goals.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-history-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-integration-regressions.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-light-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-loading-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-overview-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-overview.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-rebalance-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-rebalance.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-refresh-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-settings-a.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-settings-b.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-summary-desktop.spec.ts` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `tests/e2e/fidelity-sync-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-toasts-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-wallets-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fidelity-wallets.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/fixed-shell-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/format-golden.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/goals-empty-states.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/history-card-alignment.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/history-kpi-overflow.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/history-kpi-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/history-master-detail.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/icon-quiet.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/icon-style.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/import-preview.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-attribution-layout.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-brand-logo.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-chart-tooltip.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-coin-header.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-coin-layout-balance.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-coin-layout-law.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-coin-metric-fit.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-coin-stat-clearance.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-comparison-movers-layout.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-d3-visual.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-d4-consistency.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-edit-log.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-fidelity-cost-basis.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-fidelity-history-detail.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-fidelity-history.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| D | `tests/e2e/fidelity-summary.spec.ts` | both | keep behavior | additive P&L, known totals, or retained data checks |
| A | `tests/e2e/ios-fidelity-summary-layout.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| D | `tests/e2e/ios-fidelity-summary.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-goals-empty-states.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-history-kpi-overflow.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-history-master-detail.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-import-preview.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-interactions.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-kpi-overflow.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-layout-audit.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-navigation-state.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-overlay-theme-tokens.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-overview-chart-hit-area.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-overview-chart-hover.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-overview-source-icon.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-parity.spec.ts` | both | keep behavior | retained behavior or its regression check |
| A | `tests/e2e/ios-pnl-additive-intervals.spec.ts` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `tests/e2e/ios-profit-hint-popover.spec.ts` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `tests/e2e/ios-profit-summary-partial.spec.ts` | both | keep behavior | additive P&L, known totals, or retained data checks |
| M | `tests/e2e/ios-profit-summary-sparse.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-public-ip.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-refresh-single-progress.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-refresh-theme.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-settings.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-shell-theme.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-source-rename.spec.ts` | data | keep behavior | alias persistence and current source identity |
| A | `tests/e2e/ios-summary-range-baseline.spec.ts` | both | keep behavior | Summary range selection and preceding snapshot baseline |
| M | `tests/e2e/ios-summary-top-list-layout.spec.ts` | both | keep behavior | retained P&L numbers; the 1 px row-height limit is measured at 1/1024 px precision |
| A | `tests/e2e/ios-sync-popover-layout.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-sync-status.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-tag-theme.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-terminal.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-topbar-status.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-ui-bugs.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-ui37-btc-viewport.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-ui37-tablet-hit-area.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-ui46-partial-range.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ios-ui46-stock-percentage.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-usage.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ios-wide.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/kpi-overflow-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/kpi-overflow.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/layout-audit-captures.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/layout-audit-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/layout-audit-summary-month.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/layout-audit.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/layout-audit.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/marketing-screens.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/mobile.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/navigation-state.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/other-detail-layout.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/overlay-theme-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/overlay-theme-tokens.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/overview-chart-hit-area.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/overview-chart-hover.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/overview-chart-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/partial-snapshot-captures.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/pnl-additive-intervals.spec.ts` | both | keep behavior | additive P&L, known totals, or retained data checks |
| A | `tests/e2e/pnl-additive-scenes.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `tests/e2e/profit-hint-popover.spec.ts` | data | keep behavior | additive P&L, known totals, or retained data checks |
| M | `tests/e2e/profit-summary-partial.spec.ts` | both | keep behavior | additive P&L, known totals, or retained data checks |
| A | `tests/e2e/public-ip-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/public-ip.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/refresh-single-progress-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/refresh-single-progress.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/settings-card-layout.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/settings-phase6-capture.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/settings-phase6.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/shell-theme.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/signed-value-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/signed-value-wrap.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/smoke.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/source-rename-scenes.ts` | both | keep behavior | alias persistence and current source identity |
| A | `tests/e2e/source-rename.spec.ts` | data | keep behavior | alias persistence and current source identity |
| M | `tests/e2e/summary-card-height.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/summary-range-baseline.spec.ts` | both | keep behavior | Summary range selection and preceding snapshot baseline |
| M | `tests/e2e/summary-top-list-layout-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/summary-top-list-layout.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/sync-details-captures.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/sync-popover-layout.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/sync-popover-scenes.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/tag-theme.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/tauri-bridge.ts` | data | keep behavior | retained behavior or its regression check |
| M | `tests/e2e/terminal-shell.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/topbar-status.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| M | `tests/e2e/ui-bugs-desktop.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |
| A | `tests/e2e/ui37-final-regressions.spec.ts` | visual | revert to 0.9.9 | test or capture for reverted appearance |

Classification: 424 visual reverted; 76 data or behavior kept; 73 mixed paths with 0.9.9 presentation or explicit updater exception and retained behavior.

The 0.9.10 chart hover tooltip content from `chart-tooltip.tsx` and `overview-chart-tooltip.tsx` was reverted. It depended on new hit targets and a positioned portal, which would change the 0.9.9 tooltip placement and size. The existing 0.9.9 chart tooltips remain. Additive P&L explanations stay in the existing Summary hint positions.

The alias editor uses the existing source row and dialog styling, with a 28 px desktop action target and a 44 px touch target. The updater stall handling, its progress and retry dialog, and external documentation links remain from master.

Partly known P&L retains the 0.9.9 presentation: coin detail shows the known amount with only a hover title explaining that it is partial; desktop Unknown-group rows colour that known amount by sign; and the Summary top list can show $0 for a partly unknown stablecoin with a known $20 portion. These are listed visual trade-offs of the rollback.

The updater's manual-download error names its new `track3.dev/download.html` destination, so that one 0.9.9 translation value changes. The five 0.9.9 updater and About keys removed by #862 remain in both desktop catalogs to preserve the baseline key set.

The generated UI inventory golden includes #862's new updater reducer, and its fixture in `tests/golden/ui-persistence-inventory.json` was updated accordingly.

The existing desktop Playwright fixtures in `tests/e2e/fidelity-about-desktop.spec.ts`, `tests/e2e/fidelity-update-desktop.spec.ts`, and `tests/e2e/release-notes.spec.ts` now exercise #862's guarded dialog and separate download/install plugin calls. These files were unchanged between 0.9.9 and master, so they are listed here as required post-merge fixture updates.
