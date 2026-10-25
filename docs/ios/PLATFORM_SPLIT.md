# Platform split decisions

The fork-to-master table below covers all 147 files present on desktop `origin/master` that the iOS port changed between its first commit `1f79a83` and `ios/main`. `src/main.tsx` is the single lazy shell selector; it was not changed in the original iOS fork. The P2 audit first lists the current desktop-facing diff.

## P2 audit of the current desktop-facing diff

Each path below differs from desktop `origin/master` and sits outside `src/mobile/`, `docs/ios/`, and the Apple project. Existing desktop component files, `src/App.tsx`, `src/style.css`, desktop locale JSON, `src-tauri/tauri.conf.json`, `publish.yaml`, `test-on-pr.yaml`, and the desktop Playwright spec files are identical to master. `src/utils/app.ts`, `currency.ts`, and `hook.ts` were restored during P2. New phone code in `src/mobile/`, native files named `ios_*`, `src-tauri/Info.ios.plist`, `src-tauri/tauri.ios.conf.json`, and `src-tauri/capabilities/mobile.json` are platform-specific additions.

| Path | Classification and desktop effect |
| --- | --- |
| `.env.production` | Build setting: disables the simulator readiness probe in a normal production build. |
| `.github/workflows/ios-foundation.yml` | New iOS and web verification; existing desktop workflows stay unchanged. |
| `AGENTS.md` | Platform rules and test commands. |
| `README.md` | iPhone section and screenshot links; desktop installation and release text stays intact. |
| `index.html` | Shared viewport and a probe that is inert unless the iOS simulator build opts in. |
| `package.json` | `test:e2e` selects the desktop project, preserving the old script's desktop scope after mobile specs were added. Dependencies and `yarn.lock` are unchanged. |
| `playwright.config.ts` | Names desktop and mobile projects; the desktop project excludes new phone specs. |
| `playwright.preview.config.ts` | New production startup browser check for the lazy shell. |
| `vite.config.ts` | Gives React one shared vendor chunk to keep the lazy shell graph free of an import cycle. The desktop entry preloads no mobile UI chunk or mobile CSS. |
| `scripts/ios/check-screenshot.swift` | Simulator screenshot check used only in the new iOS workflow. |
| `scripts/ios/configure-project.py` | Xcode project generation check used only in the new iOS workflow. |
| `src-tauri/Cargo.lock` | Adds only the root crate's already locked `objc2-foundation` target dependency and pure-test `fs2`/`libc` references. |
| `src-tauri/Cargo.toml` | Adds a library entry and target-specific iOS dependency; process, shell, and updater remain desktop dependencies. |
| `src-tauri/build.rs` | Adds linker flags only when Cargo's target OS is iOS. |
| `src-tauri/capabilities/migrated.json` | Limits the unchanged desktop permissions to desktop platforms; iOS uses `mobile.json`. |
| `src-tauri/pure-tests/Cargo.toml` | Enables Linux tests of shared startup security code. |
| `src-tauri/pure-tests/src/lib.rs` | Exposes shared startup security and pure share-path checks to GTK-free tests. |
| `src-tauri/src/app.rs` | Moves the original desktop commands and startup into the library entry needed by Tauri iOS; desktop plugins and key loading still run on desktop. iOS startup and native calls are gated. |
| `src-tauri/src/bin/export-assistant-chats.rs` | Updates the crate import to the iOS-compatible library name. The CLI logic is unchanged. |
| `src-tauri/src/ios_share_path.rs` | Pure validator for an iOS share destination; no desktop caller. |
| `src-tauri/src/key_rotation/files.rs` | Selects Keychain only on iOS; desktop file rotation path remains the same. |
| `src-tauri/src/key_rotation/mod.rs` | Adds iOS Keychain update and rollback branches; desktop file branch remains. |
| `src-tauri/src/key_rotation/preflight.rs` | Reads the platform key through the new helper; the helper uses the original file read on desktop. |
| `src-tauri/src/lib.rs` | Exposes the shared app entry and gates native iOS modules. |
| `src-tauri/src/main.rs` | Desktop executable calls the shared app entry and retains the Windows subsystem setting. |
| `src-tauri/src/startup_security.rs` | Adds iOS key creation and recovery; the existing desktop key loader is unchanged. |
| `src/i18n/index.tsx` | Lets the mobile shell supply its own flat catalog; desktop still uses the original dictionaries. |
| `src/main.tsx` | Selects one shell at startup. `src/mobile/App.tsx` is dynamically imported only on iOS. |
| `src/middlelayers/ai/actions/index.ts` | Uses the shared export helper; on desktop it still opens the same save picker and writes the selected path. |
| `src/middlelayers/charts-refresh.ts` | Carries optional source completion and timing for phone refresh progress; desktop callers omit the callback. |
| `src/middlelayers/configuration.ts` | Returns an empty date range for empty history, fixing the crash without changing populated portfolios. |
| `src/middlelayers/cost-basis-data.ts` | Uses the shared export helper with the same desktop picker and file content. |
| `src/middlelayers/data.ts` | Adds source completion and iOS export/share support; desktop fetch and save behavior remains. |
| `src/middlelayers/portfolio-baseline.ts` | Adds optional source timing fields; existing status fields keep their shape. |
| `src/middlelayers/source-status.ts` | Validates optional timing fields before status display; existing status fields keep their shape. |
| `src/test/ios-configure-project.test.ts` | New Xcode project test only. |
| `src/test/skills/ios-project.test.ts` | New iOS project and configuration test only. |
| `src/utils/backup-location.ts` | Chooses Documents only on iOS; its phone settings page is the sole caller. |
| `src/utils/backup-location.test.ts` | Tests both platform branches of the new helper. |
| `src/utils/export-file.ts` | Keeps the original picker/write sequence on desktop and stages picker files on iOS. |
| `src/utils/export-file.test.ts` | Tests desktop and iOS export behavior. |
| `src/utils/ios-native.ts` | Phone native command adapter; no desktop UI caller. |
| `src/utils/ios-native.test.ts` | Tests native adapter platform guards. |
| `src/utils/ios-ready.ts` | Simulator readiness probe; no desktop caller. |
| `src/utils/ios-ready.test.ts` | Tests the simulator probe guard and readiness marker. |
| `src/utils/ios-startup-probe.test.ts` | Checks that normal production HTML disables the simulator probe. |
| `src/utils/platform.ts` | Detects iOS at the single shell boundary and supplies phone safe-area and keyboard state. |
| `src/utils/platform.test.tsx` | Tests platform detection and phone viewport state. |
| `src/utils/share-export.ts` | Supplies the phone share action called from shared export orchestration. |
| `src/utils/share-export.test.ts` | Tests temporary share-file cleanup. |
| `tests/e2e/ios-d3-visual.spec.ts` | New mobile presentation checks, excluded from the desktop project. |
| `tests/e2e/ios-d4-consistency.spec.ts` | New mobile presentation checks, excluded from the desktop project. |
| `tests/e2e/ios-parity.spec.ts` | New mobile feature checks, excluded from the desktop project. |
| `tests/e2e/ios-settings.spec.ts` | New mobile settings checks, excluded from the desktop project. |
| `tests/e2e/mobile.spec.ts` | New mobile route and interaction checks, excluded from the desktop project. |
| `tests/e2e/tauri-bridge.ts` | Adds phone fixtures and retains the original desktop call signature. |
| `tests/e2e/tsconfig.json` | Includes the new production startup browser spec and preview configuration. |
| `tests/production/startup.spec.ts` | Verifies a production desktop build starts through the lazy shell. |

## Fork-to-master decisions

| Master file | Decision | Why |
| --- | --- | --- |
| `.agents/skills/version-upgrade/SKILL.md` | Restored | Release workflow belongs to the desktop release. |
| `.github/workflows/publish.yaml` | Restored | Desktop release jobs and action versions stay on master. |
| `.github/workflows/test-on-pr.yaml` | Restored | Existing desktop CI jobs stay on master; the desktop browser command selects its project. |
| `AGENTS.md` | Kept | Added platform split and verification rules. |
| `README.md` | Kept | Preserved the desktop README and added an iPhone section with screenshots. |
| `index.html` | Kept | Shared viewport support; startup probe runs only when enabled for iOS CI. |
| `playwright.config.ts` | Kept | Desktop and mobile browser projects, with the desktop script selecting desktop. |
| `src-tauri/Cargo.lock` | Kept | Locks dependencies for the shared desktop and iOS crate. |
| `src-tauri/Cargo.toml` | Kept | Adds iOS library target and target-specific dependencies; desktop plugins remain desktop-only. |
| `src-tauri/build.rs` | Kept | Adds iOS-only linker configuration. |
| `src-tauri/capabilities/migrated.json` | Kept | Limits existing permissions to desktop platforms; iOS uses its own capability. |
| `src-tauri/pure-tests/Cargo.toml` | Kept | Adds dependencies to test iOS-related pure Rust code on Linux. |
| `src-tauri/pure-tests/src/lib.rs` | Kept | Exposes pure key and share-path checks without GTK. |
| `src-tauri/src/bin/export-assistant-chats.rs` | Kept | Uses the library crate name required by the iOS library target. |
| `src-tauri/src/key_rotation/files.rs` | Kept | Adds iOS Keychain and backup-exclusion paths behind target cfg. |
| `src-tauri/src/key_rotation/mod.rs` | Kept | Adds iOS Keychain rotation and rollback behind target cfg. |
| `src-tauri/src/key_rotation/preflight.rs` | Kept | Reads the platform key through the shared rotation preflight. |
| `src-tauri/src/lib.rs` | Kept | Exports shared entry and gates native iOS modules. |
| `src-tauri/src/main.rs` | Moved to `src-tauri/src/app.rs` | Shared Tauri setup became a library entry for iOS; desktop main calls that entry. |
| `src-tauri/src/startup_security.rs` | Kept | Adds iOS key creation, migration, and recovery with target-specific behavior. |
| `src/App.tsx` | Moved to `src/mobile/App.tsx` | The iOS shell and gates live behind the lazy boundary; desktop App is restored. |
| `src/components/app-shell-accessibility.test.tsx` | Moved to `src/mobile/components/app-shell-accessibility.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/appearance.tsx` | Moved to `src/mobile/components/appearance.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/assets-percentage-change.test.tsx` | Moved to `src/mobile/components/assets-percentage-change.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/assets-percentage-change.tsx` | Moved to `src/mobile/components/assets-percentage-change.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/assistant/chat-composer.test.tsx` | Moved to `src/mobile/components/assistant/chat-composer.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/assistant/chat-composer.tsx` | Moved to `src/mobile/components/assistant/chat-composer.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/assistant/chat-page.test.tsx` | Moved to `src/mobile/components/assistant/chat-page.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/assistant/chat-page.tsx` | Moved to `src/mobile/components/assistant/chat-page.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/assistant/chat-thread.test.tsx` | Moved to `src/mobile/components/assistant/chat-thread.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/assistant/chat-thread.tsx` | Moved to `src/mobile/components/assistant/chat-thread.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/assistant/message-bubble.test.tsx` | Moved to `src/mobile/components/assistant/message-bubble.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/assistant/message-bubble.tsx` | Moved to `src/mobile/components/assistant/message-bubble.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/assistant/quick-actions.tsx` | Moved to `src/mobile/components/assistant/quick-actions.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/assistant/session-sidebar.test.tsx` | Moved to `src/mobile/components/assistant/session-sidebar.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/assistant/session-sidebar.tsx` | Moved to `src/mobile/components/assistant/session-sidebar.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/ath-value.tsx` | Moved to `src/mobile/components/ath-value.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/auto-backup-indicator.tsx` | Moved to `src/mobile/components/auto-backup-indicator.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/auto-updater.test.tsx` | Restored | The updater is desktop-only; no mobile copy is needed. |
| `src/components/auto-updater.tsx` | Restored | The updater is desktop-only; no mobile copy is needed. |
| `src/components/coin-analytics.test.tsx` | Moved to `src/mobile/components/coin-analytics.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/coin-analytics.tsx` | Moved to `src/mobile/components/coin-analytics.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/coins-amount-and-value-change.test.tsx` | Moved to `src/mobile/components/coins-amount-and-value-change.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/coins-amount-and-value-change.tsx` | Moved to `src/mobile/components/coins-amount-and-value-change.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/common/ai-setup-card.tsx` | Moved to `src/mobile/components/common/ai-setup-card.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/common/confirm-delete-dialog.tsx` | Moved to `src/mobile/components/common/confirm-delete-dialog.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/common/theme/index.tsx` | Moved to `src/mobile/components/common/theme/index.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/comparison-page.test.tsx` | Moved to `src/mobile/components/comparison-page.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/comparison.tsx` | Moved to `src/mobile/components/comparison.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/configuration-base-currency.test.tsx` | Moved to `src/mobile/components/configuration-base-currency.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/configuration/attach-modal.tsx` | Moved to `src/mobile/components/configuration/attach-modal.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/configuration/general-settings.test.tsx` | Moved to `src/mobile/components/configuration/general-settings.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/configuration/general-settings.tsx` | Moved to `src/mobile/components/configuration/general-settings.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/configuration/index.tsx` | Moved to `src/mobile/components/configuration/index.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/configuration/others-section.test.tsx` | Restored | The shared component keeps its desktop test; the iOS sources page uses mobile-specific controls. |
| `src/components/configuration/quick-look-dialog.tsx` | Moved to `src/mobile/components/configuration/quick-look-dialog.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/configuration/summary-cards.test.tsx` | Restored | The shared summary cards keep their desktop test; iOS uses its own sources page. |
| `src/components/cost-basis.test.tsx` | Moved to `src/mobile/components/cost-basis.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/cost-basis.tsx` | Moved to `src/mobile/components/cost-basis.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/data-management-blacklist.test.tsx` | Moved to `src/mobile/components/data-management-blacklist.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/data-management.tsx` | Moved to `src/mobile/components/data-management.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/date-picker.tsx` | Moved to `src/mobile/components/date-picker.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/finance-charts.test.tsx` | Moved to `src/mobile/components/finance-charts.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/finance-charts.tsx` | Moved to `src/mobile/components/finance-charts.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/goals-alerts.test.tsx` | Moved to `src/mobile/components/goals-alerts.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/goals-alerts.tsx` | Moved to `src/mobile/components/goals-alerts.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/historical-data.tsx` | Moved to `src/mobile/components/historical-data.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/index/index-coin-data-changed.test.tsx` | Moved to `src/mobile/components/index/index-coin-data-changed.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/index/index-data-changed.test.tsx` | Moved to `src/mobile/components/index/index-data-changed.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/index/index-summary-date-range.test.tsx` | Moved to `src/mobile/components/index/index-summary-date-range.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/index/index.css` | Restored | Desktop presentation or test stays identical to master. |
| `src/components/index/index.tsx` | Moved to `src/mobile/components/index/index.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/insights-card.tsx` | Moved to `src/mobile/components/insights-card.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/latest-assets-percentage.tsx` | Moved to `src/mobile/components/latest-assets-percentage.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/overview-card-alignment.test.tsx` | Moved to `src/mobile/components/overview-card-alignment.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/overview-mobile-density.test.tsx` | Moved to `src/mobile/components/overview-mobile-density.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/overview-semantic-controls.test.tsx` | Moved to `src/mobile/components/overview-semantic-controls.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/overview.tsx` | Moved to `src/mobile/components/overview.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/page-loading-overlay.tsx` | Moved to `src/mobile/components/page-loading-overlay.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/page-shell-loading.test.tsx` | Moved to `src/mobile/components/page-shell-loading.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/page-wrapper.tsx` | Moved to `src/mobile/components/page-wrapper.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/pnl-chart.tsx` | Moved to `src/mobile/components/pnl-chart.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/pnl.tsx` | Moved to `src/mobile/components/pnl.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/profit-attribution.test.tsx` | Moved to `src/mobile/components/profit-attribution.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/profit-attribution.tsx` | Moved to `src/mobile/components/profit-attribution.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/profit-loading.test.tsx` | Moved to `src/mobile/components/profit-loading.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/profit-metrics.test.tsx` | Moved to `src/mobile/components/profit-metrics.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/profit-metrics.tsx` | Moved to `src/mobile/components/profit-metrics.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/profit-summary.tsx` | Moved to `src/mobile/components/profit-summary.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/profit.tsx` | Moved to `src/mobile/components/profit.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/range-sensitive-queries.test.tsx` | Moved to `src/mobile/components/range-sensitive-queries.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/rebalance.test.tsx` | Moved to `src/mobile/components/rebalance.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/rebalance.tsx` | Moved to `src/mobile/components/rebalance.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/refresh-data.test.tsx` | Moved to `src/mobile/components/refresh-data.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/refresh-data.tsx` | Moved to `src/mobile/components/refresh-data.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/refresh-duplicate-fetch.test.tsx` | Moved to `src/mobile/components/refresh-duplicate-fetch.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/settings-shell.test.tsx` | Moved to `src/mobile/components/settings-shell.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/settings/assistant.tsx` | Moved to `src/mobile/components/settings/assistant.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/settings/index.tsx` | Moved to `src/mobile/components/settings/index.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/settings/sync.tsx` | Moved to `src/mobile/components/settings/sync.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/summary.tsx` | Moved to `src/mobile/components/summary.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/sync-status-indicator.tsx` | Moved to `src/mobile/components/sync-status-indicator.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/system-info-subscription.test.tsx` | Moved to `src/mobile/components/system-info-subscription.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/system-info.tsx` | Moved to `src/mobile/components/system-info.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/top-coins-percentage-change.tsx` | Moved to `src/mobile/components/top-coins-percentage-change.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/top-coins-rank.tsx` | Moved to `src/mobile/components/top-coins-rank.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/total-value-and-change.tsx` | Moved to `src/mobile/components/total-value-and-change.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/ui/alert-dialog.tsx` | Moved to `src/mobile/components/ui/alert-dialog.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/ui/card.tsx` | Moved to `src/mobile/components/ui/card.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/ui/dialog.tsx` | Moved to `src/mobile/components/ui/dialog.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/ui/skeleton.tsx` | Moved to `src/mobile/components/ui/skeleton.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/ui/switch.tsx` | Moved to `src/mobile/components/ui/switch.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/ui/toast.tsx` | Moved to `src/mobile/components/ui/toast.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/ui/toaster.tsx` | Moved to `src/mobile/components/ui/toaster.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/use-alert-badge.test.ts` | Moved to `src/mobile/components/use-alert-badge.test.ts` | Mobile test variant; the existing desktop test is restored. |
| `src/components/use-alert-badge.ts` | Moved to `src/mobile/components/use-alert-badge.ts` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/wallet-analytics.tsx` | Moved to `src/mobile/components/wallet-analytics.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/wallet-assets-change.tsx` | Moved to `src/mobile/components/wallet-assets-change.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/components/wallet-assets-percentage.test.tsx` | Moved to `src/mobile/components/wallet-assets-percentage.test.tsx` | Mobile test variant; the existing desktop test is restored. |
| `src/components/wallet-assets-percentage.tsx` | Moved to `src/mobile/components/wallet-assets-percentage.tsx` | Mobile presentation or mobile test variant; the desktop file is restored. |
| `src/i18n/locales/catalog-parity.test.ts` | Restored | Existing desktop locale parity test stays unchanged. |
| `src/i18n/locales/en.json` | Restored | Mobile-only keys live in `src/mobile/en.json`; the desktop catalog matches master. |
| `src/i18n/locales/zh.json` | Restored | Mobile-only keys live in `src/mobile/zh.json`; the desktop catalog matches master. |
| `src/middlelayers/ai/actions/index.ts` | Kept | Shared export and date logic is used by both platforms; desktop operations retain their path. |
| `src/middlelayers/charts-refresh.test.ts` | Restored | Existing desktop test stays unchanged; mobile flows have separate tests. |
| `src/middlelayers/charts-refresh.ts` | Kept | Shared source identity, status, timing, and progress data serve both shells without changing desktop presentation. |
| `src/middlelayers/configuration.test.ts` | Restored | Existing desktop test stays unchanged; mobile flows have separate tests. |
| `src/middlelayers/configuration.ts` | Kept | Shared export and date logic is used by both platforms; desktop operations retain their path. |
| `src/middlelayers/cost-basis-data.ts` | Kept | Shared source identity, status, timing, and progress data serve both shells without changing desktop presentation. |
| `src/middlelayers/data-source-fallback.test.ts` | Restored | Existing desktop test stays unchanged; mobile flows have separate tests. |
| `src/middlelayers/data.ts` | Kept | Shared source identity, status, timing, and progress data serve both shells without changing desktop presentation. |
| `src/middlelayers/portfolio-baseline.ts` | Kept | Shared source identity, status, timing, and progress data serve both shells without changing desktop presentation. |
| `src/middlelayers/refresh-sources.test.ts` | Restored | Existing desktop test stays unchanged; mobile flows have separate tests. |
| `src/middlelayers/source-status.test.ts` | Restored | Existing desktop test stays unchanged; mobile flows have separate tests. |
| `src/middlelayers/source-status.ts` | Kept | Shared source identity, status, timing, and progress data serve both shells without changing desktop presentation. |
| `src/style.css` | Moved to `src/mobile/ios-style.css` | Mobile theme and viewport CSS loads with the mobile shell; desktop CSS is restored. |
| `src/test/skills/pr-workflow.test.ts` | Restored | Existing desktop test stays unchanged. |
| `src/utils/app.test.ts` | Restored | Existing desktop test stays unchanged. |
| `src/utils/app.ts` | Restored | Only the desktop updater and appearance page call reload; the phone appearance page applies theme without a relaunch. |
| `src/utils/chart-theme.ts` | Moved to `src/mobile/chart-theme.ts` | Mobile chart colors, fonts, and gradients differ; desktop chart defaults are restored. |
| `src/utils/currency.ts` | Restored | Phone money formatting lives in `src/mobile/currency.ts`. |
| `src/utils/hook.ts` | Restored | The phone shell does not install the desktop context-menu handler. |
| `tailwind.config.js` | Restored | Font changes were mobile presentation; mobile CSS selects iOS fonts. |
| `tests/e2e/accessibility.spec.ts` | Restored | Existing desktop accessibility checks stay unchanged. |
| `tests/e2e/density.spec.ts` | Restored | Existing desktop density checks stay unchanged. |
| `tests/e2e/smoke.spec.ts` | Restored | Existing desktop smoke checks stay unchanged. |
| `tests/e2e/tauri-bridge.ts` | Kept | Shared IPC fixture adds iOS mocks while desktop defaults remain. |
| `vite.config.ts` | Kept shared fix | React has its own vendor chunk so the lazy desktop and mobile entry does not create a chart chunk cycle. Other desktop chunking stays on master. |

## Directory layout

- `src/components/` and `src/App.tsx`: desktop presentation, restored from master.
- `src/mobile/components/` and `src/mobile/App.tsx`: iPhone presentation and co-located tests. Unchanged primitives are imported from `src/components/`.
- Mobile code imports unchanged desktop components from `src/components/`. The iOS sources page uses mobile-specific controls; its unused desktop-style configuration sections and navigation copies are removed. Other mobile copies retain platform-specific presentation or behavior.
- `src/middlelayers/`: shared portfolio, refresh, assistant, sync, and persistence logic.
- `src-tauri/src/app.rs`: shared Tauri commands and setup; native iOS modules are gated by `cfg(target_os = "ios")`.
- `src-tauri/tauri.conf.json` and `capabilities/migrated.json`: desktop settings; `tauri.ios.conf.json` and `capabilities/mobile.json`: iOS overrides.
- `src/mobile/en.json` and `zh.json`: mobile copy. Existing desktop locale entries retain their master values.

## Browser checks

`corepack yarn test:e2e` selects the desktop Playwright project. `corepack yarn playwright test --project=mobile` runs the iPhone browser suites. macOS CI builds and launches the simulator separately.
