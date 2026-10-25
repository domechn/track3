# iOS port progress

## P2 reviewer follow-up (2026-10-25)

- The driver pushed P2 commit `febab6d`. [iOS foundation run 40165424556](https://github.com/domechn/track3/actions/runs/40165424556) passed both `web` and `ios` jobs, including the simulator build and launch. These reviewer fixes are local and have no CI result yet. No pull request exists for `feat/ios-app-p2`, so the existing `test-on-pr` workflow has not run.
- The mobile Appearance screen now applies theme changes through its theme context without the desktop process plugin. The iPhone browser bridge rejects process, updater, and shell commands. The desktop `App` is again imported directly at startup, while the mobile shell remains lazy. The React vendor chunk remains necessary: removing it caused a production startup failure, which the production browser smoke test caught.
- The mobile shell no longer imports or renders the desktop Sidebar. Desktop Rust no longer registers `ios_*` commands, and the unused test-only file-key shim is gone. The unrelated Linux package edit in `AGENTS.md` was reverted.
- Current local checks passed: app and browser-test TypeScript, 2,206 Vitest tests in 262 files, 77/77 desktop Playwright checks, 141/141 mobile Playwright checks, 2/2 production startup checks, 62/62 pure Rust tests, 116/116 desktop Rust library tests, 6/6 assistant export CLI tests, desktop `cargo check --locked --lib --bins`, and the production Vite build. The direct desktop entry and its nine statically linked assets contain no mobile UI markers. The first browser runs saw a 36.000015 px floating-point measurement and two failures while Vite configuration was changing; the focused checks and both complete reruns passed. `git diff --check` passed.
- A signed-device check is still required for Keychain migration and restore, Face ID or Touch ID, the privacy cover, haptics, notifications and badge, Files and iCloud Drive, and live source connections. [RELEASE.md](RELEASE.md) records the device checklist.

## P2 desktop audit and local verification (`febab6d` baseline)

- [PLATFORM_SPLIT.md](PLATFORM_SPLIT.md) now lists every current desktop-facing changed path and its purpose. `src/App.tsx`, desktop components, styles, locale files, the desktop Tauri configuration, release and PR workflows, and existing desktop browser specs are byte-for-byte the master versions. P2 restored the desktop app reload, context menu, and currency utilities; phone money formatting moved to `src/mobile/currency.ts`. The original desktop Playwright calls now work through the shared bridge without spec edits. Desktop updater, process, shell, menu, window, and keyboard controls remain on the desktop path. Master has no tray or global shortcut registration.
- On `febab6d`, the production HTML entry statically imported six shared JavaScript chunks and no phone UI chunk or CSS. It dynamically imported the phone shell only for iOS and the desktop shell otherwise. The production preview rendered both shells without JavaScript errors. Desktop Rust `cargo check --locked --lib --bins` passed; process, shell, and updater are desktop dependencies, and `objc2-foundation` is iOS-targeted. `Cargo.lock` adds only three dependency references and no new package versions. The committed Xcode project was unchanged after `configure-project.py`, and regenerated iOS icons matched the committed assets.
- On `febab6d`, local checks passed: app and browser-test TypeScript, production frontend build, 2,204 Vitest tests in 262 files, coverage thresholds (82.35% statements, 62.58% branches, 81.46% functions, 82.43% lines), 77/77 desktop Playwright checks, 140/140 mobile Playwright checks, 2/2 production startup checks, 64/64 pure Rust tests, 118/118 desktop Rust library tests, 6/6 assistant export CLI tests, and desktop Rust library/binary checks. The first mobile run was 139/140 because the light loading screenshot waited until its skeleton had disappeared; the capture then began at navigation commit, passed six focused repetitions, and passed the full rerun. `git diff --check` passed.

## P1 integration into desktop master

The iOS port now lives in this repository. `src/main.tsx` lazily selects
`src/mobile/App.tsx` on iOS; the desktop shell, component files, styles,
existing unit tests, and existing desktop Playwright tests are restored to
master. Shared portfolio logic remains in `src/middlelayers/`, and native iOS
code uses the Tauri library entry. [PLATFORM_SPLIT.md](PLATFORM_SPLIT.md)
records decisions for each master file changed by the fork.

Local P1 checks on this worktree: frontend TypeScript and production build
passed; browser-test TypeScript, 2,216 Vitest tests in 266 files, and the
configured coverage thresholds passed; the unchanged desktop Playwright
project passed 77/77, the iPhone project passed 140/140, and pure Rust tests
passed 61/61. The iOS simulator, unsigned IPA, and CI jobs require the driver
to push this branch and report the workflow result. The sections below record
earlier work in the separate iOS repository and do not verify this integrated
worktree.

## D4 reviewer follow-up after b9a2fc3

- The 320 pt treemap keeps labels intact inside tiles. Wallet Value Changes uses a short phone search prompt and single-line Value, %, and Volatility segments. The three Wallets share metrics align in one row, and allocation percentages use the primary label colour. English and Chinese catalogs have matching keys.
- Overview Percent and BTC base now render the shared 51×31 pt green Radix switch with a 44 pt tall target. Goals and Overview canvas ticks use the same phone system font, and Goals omits vertical gridlines. Pushed compact titles and the goal editor actions sit on centered or 16 pt aligned headers. Monthly P&L has clearer heading line spacing and an All months return action.
- Portfolio query errors stay on the seven data routes; Settings, Backup, More, Goals, and Rebalance remain accessible. The Source status sheet describes failed or stale sources by count and lists their names once below. The rich Assistant screenshot fixture answers a portfolio question with holdings, a gain, and a loss, without a lingering Thinking label.
- The b9a2fc3 baseline passed CI run 40113141596. This follow-up has no CI run yet because the driver handles commits and pushes. Local app and browser TypeScript checks pass, Vitest passes 1,883 tests in 228 files, the full iPhone browser suite passes 142/142, and the desktop browser suite passes 93/93. The first full iPhone pass had one outdated assertion for the former Overview buttons; it was updated and the full suite passed on rerun. The browser run regenerated 591 PNGs, with primary, feature, loading, empty, and data-error captures checked across the documented light and dark matrix. The Assistant fixture was then corrected to match the seeded AAPL gain, and its eight light and dark phone captures passed again. After matching Overview canvas tick fonts to Goals, all four primary-route capture tests passed again at 320, 375, 390, and 430 pt. The 14 curated 2× PNGs were regenerated and losslessly compressed to about 1.75 MB. I inspected the 320 pt Wallets and P&L, goal editor, Goal chart, dark Source status, Overview, and Assistant captures. A physical iPhone was not tested.

## D4 visual QA on b9a2fc3

- The rich dark Analytics fixture now checks the actual `% from ATH` text against its card background at the WCAG AA 4.5:1 threshold. The 700 gain and loss classes use the semantic phone colours. Desktop Source status rows have their horizontal flex layout again, with the phone grid kept inside the phone media query.
- Large titles use `ios-large-title` and the same 16 pt page inset on Settings, Data sources, Goals, Rebalance, and the data routes. Card headings use quiet 13 pt secondary text, including Goals, Rebalance, setup prompts, and Assistant insights. The Rules heading stays outside its grouped surface when empty and populated. At 320 pt, performance uses two centered metric stacks and a full-width centered stack with no text overflow; at 390 pt, all three columns align their labels and values within 1 pt.
- Cost basis gain and loss charts use the shared semantic colours. Goals ticks use lowercase compact units on phone; negative Overview chart ticks use the true minus sign. Overview and Comparison ranges read 7D through All in English, and Profit metrics uses sentence case. The Assistant usage line has quieter copy and scrollable chips keep an end inset. Custom BTC source rows use the existing BTC logo. Illustrated load errors and empty states share the grouped background.
- The D3 screenshot test now captures at 2× device resolution like the primary route test. The new D4 browser regression suite is included in the iPhone CI screenshot job. Local checks passed: app and browser-test TypeScript, the production frontend build, Vitest (1,879 tests in 227 files), desktop browser and accessibility (93/93), and the iPhone browser suite (138/138). The phone suite regenerated 595 PNGs; an inventory check found the primary routes, D3 features, and data loading/empty/error states in both themes at their expected scales. I opened the 320 pt performance, dark Analytics, dark Data sources, Goals, Assistant, and empty/error captures. The 14 optimized README images are all 780×1688 and total about 1.6 MB. `git diff --check` passed. Rust was untouched. CI run 40113141596 on b9a2fc3 passed both jobs: 138 iPhone browser tests, 93 desktop tests, 61 pure Rust tests, and the simulator build and launch. The reviewer then identified the visual issues recorded in the follow-up above.

## D4 previous follow-up (6caf1ff)

- Consolidated the phone shell, data-screen, and feature-screen rules into `src/mobile/components/mobile/mobile.css` and removed the three superseded CSS files. The semantic light/dark tokens remain in `src/style.css`. Scrolled navigation bars now use an opaque card tone to prevent the background decoration showing through.
- Rebalance trades use one-line signed symbol amounts; source status rows keep one-line identities, aligned durations, inline Retry, separated error text, and short localized timestamps. Phone Goals, Rebalance, Coin Profit, Wallets, History detail, Comparison, and Assistant labels and amounts now follow the phone currency and sentence-case conventions. Wallet aliases no longer include asset prefixes, and zero loss counts are hidden.
- The assistant card uses the same rounded surface as other phone cards. Its composer has a transparent wrapper, quick actions reach the screen edge, and its six empty-state suggestions use a two-column layout so the complete Insights card fits at 390 px. The Goals header action now matches the bare shell icon buttons. A failed startup data query shows an illustrated retry state; loading routes show skeletons.
- The review matrix adds 320 and 430 px D2 sheets and 390 px light/dark loading, empty, and error captures for nine data destinations. The screenshot fixture still has seven holdings, 60 days of history, and mixed gains and losses. The README's 14 curated screenshots are regenerated and compressed from the final phone browser pass.
- Final local checks passed: app and browser-test TypeScript, 1,879 Vitest tests in 227 files, the production frontend build, 133/133 phone Playwright checks, and 93/93 desktop browser and accessibility checks. The phone run wrote 595 PNGs. An inventory check found no missing primary-route, D2-sheet, D3-screen, or data-state capture across the documented theme and width matrix. Fourteen optimized 390 px PNGs under `docs/ios/screens/` total about 477 KB. One Vitest attempt was interrupted by SIGTERM without a result; the completed rerun passed. `git diff --check` passed. Rust was untouched and was not rerun here. No new CI run, simulator build, or physical-device run has been made from this uncommitted worktree; the last pushed CI run, 40103460114 on b3d2da8, passed before these changes.

## D4 original visual QA pass (b3d2da8)

- Extended the browser review matrix to all four requested widths (320, 375, 390, and 430 px) in light and dark. Primary routes retain the existing overflow, clipped-text, safe-area, and chart checks; feature routes capture settings, editors, goals, rebalance, assistant, refresh, first launch, and startup states. The CI workflow already uploads `test-results/mobile/*.png` as `ios-browser-screenshots` before the desktop Playwright run clears that directory.
- The new 320 px capture found Backup's folder actions extending about 6 px beyond their card. A constrained phone grid column keeps the buttons inside the card; the light and dark tests now pass. The screenshots also exposed two header overlaps at 320 px: Save crossed into “New rule,” and the assistant's sessions button crossed into its title. The alert editor now uses a three-column header, and the assistant title and actions have measured 8 px gaps. A new dark WCAG AA route sweep found 1.67:1 text contrast on the Sync passphrase warning. The phone dark destructive token now uses the iOS loss red with a black label on filled controls; the Sync check passes.
- `docs/ios/DESIGN.md` records the final shared tokens, components, and review matrix. The README shows 14 compressed light and dark screenshots from the rich browser fixture.
- Local checks passed: frontend build and TypeScript, browser-test TypeScript, 1,879 Vitest tests in 227 files, 93 desktop Playwright tests (including the 16 new dark route checks), 122 phone Playwright tests, the final 25-test D3 visual sweep after the header fixes, 61 pure Rust tests, and `cargo check --locked --lib`. The browser runs left 485 PNGs in `test-results/mobile/`, with no missing light/dark primary or feature route capture at 320, 375, 390, or 430 px. Fourteen optimized 390×844 PNGs under `docs/ios/screens/` total about 1 MiB. The initial Rust check stopped before app compilation because this container lacked the GTK/WebKit development packages installed by CI; the check passed after installing that same package set. No new CI run, iOS simulator build, or signed-device check has been made from this uncommitted worktree.

## D2 comparison and data-screen review fixes

- Comparison leaves quick ranges unselected until one is applied. The Analytics tiles, cost values, history asset details, and sheet headings now align at phone widths. Position changes fills its sheet and uses the system font for legend percentages.
- Analytics labels and sheet titles now agree for Top coins and Returns; the monthly drill-down uses “Daily P&L.” The Analytics Net P&L section has a local 7D/1M/1Y/All control. The shared Overview section keeps its existing range behavior.
- Profit metrics use a true minus sign for drawdown, count one-day streaks as one day, and show a dash for a zero-day streak. Desktop attribution previews remain limited to five gainers and five detractors.
- Wallet Value Changes uses the same wallet names as allocation and keeps paging without a phone row-size select. The browser demo includes a September trade so that month no longer appears flat beside September best and worst days.
- Verification in this worktree: app and browser-test TypeScript passed; `corepack yarn test` passed 1,851 tests in 227 files; the mobile, iOS parity, and accessibility Playwright suites passed 135/135. They regenerated 196 PNGs under `test-results/mobile/`. I inspected 320 px route captures and 375/390 px light and dark detail captures. No new CI, simulator, or physical-device run was performed here.

## D2 reviewer follow-up

- Fixed the browser-test TypeScript error from the unsupported scroll behavior. Added a browser check for SE card margins and coin History row separation; updated assertions for the History delete position, coin detail title, and comparison pill.
- Moved History's destructive action below the asset list. Coin History uses compact dates with full timestamps in details, and its one-page pager is hidden. The phone trend now has one value axis, short horizontal dates, and four ticks. The Breakeven subtitle fits the 320 pt tile.
- Flattened Profit Metrics into a two-column tile grid with short labels, compact date ranges, and day units. Profit and Attribution cards use the same 16 pt inner gutter. Attribution rows include logos; AAPL uses the stock glyph in Allocation and Gainers. Wallet rows align with their card content and on-chain wallets have distinct tile colors. Comparison aligns Hide values to the page gutter and uses a delta pill.
- Cost basis phone values use `$` and localized lot dates. Data-screen CSS now targets semantic component classes and an additive card marker in the shared primitive.
- Final local checks passed: app and browser-test TypeScript, 1,846 Vitest tests in 226 files, and all 96 tests across the three mobile Playwright suites. The suite regenerated 196 PNGs under `test-results/mobile/`, including 56 D2 detail captures in both themes at 375 and 390 px. I inspected the refreshed coin, wallet, comparison, Profit Metrics, P&L, Attribution, History detail, and cost basis captures. CI, a simulator build, and a physical-device run have not been performed for this follow-up. The prior D2 verification figures below refer to the earlier state.

## D2 data screen redesign (this worktree)

- The Analytics hub now wraps its seven destinations into two phone columns, with no clipped tile labels. The compact live total is hidden on Analytics while its snapshot total is visible. Profit Metrics uses two-column tiles with short dates on separate lines. The History month header includes its latest total; the detail sheet has a grouped asset list, a tighter row height, and a grouped delete action.
- Coin detail puts the selector in its header and aligns its metric cards. Its 24-hour price comparison uses a nearby prior snapshot, measured from the latest stored snapshot time; wider gaps show a dash. Comparison and Wallet changes use full-width phone range controls; Wallet changes labels its row count selector. Desktop currency spacing and treemap category size are restored.
- Monthly Returns counts periods without data separately from flat periods. Attribution keeps every group reachable on phone, including quantity-only changes. Cost basis asset gains use the signed two-decimal display. The P&L axis uses evenly spaced ticks and a tap reveals its value chip. Position changes finishes chart animation immediately under reduced motion and uses short phone axis dates.
- The browser-only demo fixture still provides seven assets, two months of history, mixed gains and losses, and sale/repurchase pairs. The mobile route sweep now waits for the dark Coin and Analytics overlays to clear and for History logos to load. Captures for the six primary D2 routes exist in light and dark at 320×568 and 390×844. Fourteen D2 detail captures, including Allocation, Position changes, and Profit Metrics, exist in both themes at 375 and 390 px. I inspected the dark Coin and Analytics roots, History detail, Profit Metrics, Wallet changes, Comparison, P&L, Allocation, and Position changes captures.
- Local verification: `corepack yarn tsc --noEmit` passed; `corepack yarn vitest run` passed 1,844 tests in 226 files; the three mobile Playwright suites passed 95 checks, with affected captures rechecked after the final chart and coin fixes. No new CI, Rust, simulator, or physical-device run is available for this follow-up. Physical-device haptics remain unverified.

The earlier S1–S5 and D1 sections record their handoff results. This worktree
combines the D2 data screens and D3 feature-screen pass.

## D3 More and feature screens

- More and the pushed Settings sections use inset groups. Currency and result count open full-page pickers; Appearance applies theme and quote color on tap. The sync credential form uses full-width fields with labels above. Pushed pages show their own centered compact title after scrolling.
- Data sources use provider logos or monograms, the shared switch, a searchable provider picker, one grouped credentials form with filled inputs and field-level validation. Selecting a provider advances to credentials. The empty source screen has three setup cards and one primary Add source action; its picker includes custom assets so a first-launch owner can still add a holding.
- Goals show a progress ring and bar on iPhone, with Add alert in the top bar and matching editor actions visible on SE. Rebalance presets wrap, target fields remain visibly editable, and buy and sell values have distinct signs and colors. The assistant header aligns with Back; the completed reply is above the composer on SE and iPhone 14. Refresh shows pending and completed source rows with aligned durations, a visible result summary, and Retry actions.
- The D3 browser suite captures 34 screen states in each light/dark and SE/iPhone 14 combination, producing 136 PNGs in `test-results/mobile/`. Its current-dated 60-day review fixture shows seven assets, positive and negative trades, and a current goal value. It also captures the assistant's streaming caret and tool activity while those states are visible, plus completed refresh rows. Browser capture cannot validate native biometric prompts, the app-switcher privacy cover, hardware haptics, the real iOS keyboard, or background suspension.
- Each source result now records its own fetch start and finish time; the status normalizer accepts only valid timestamp pairs. Rows without source timing omit the duration. Pending rows use the same source IDs and labels as the fetcher, including the Pro gate. The first-launch Overview illustration remains D1-owned; the three-card onboarding appears after its primary action opens Data sources.
- Earlier D3 baseline verification passed 1,830 Vitest tests and the combined iPhone suite. Current review checks are recorded below after rerunning them.

### D3 reviewer fixes verification

- The reviewer fixes passed `corepack yarn tsc --noEmit` and `corepack yarn vitest run`: 1,852 tests across 224 files. The first full Vitest run found two assertions tied to the revised phone copy and onboarding flow; both were updated to preserve their original checks, then the full suite passed.
- The four mobile browser suites passed 102/102 checks. The D3 suite wrote 136 light and dark PNGs at SE and iPhone 14 sizes in `test-results/mobile/`. The first browser pass exposed the first-launch custom-asset path hidden with the stray link; the Add source picker now includes that action, and the full browser run passed.
- Inspected SE light and dark screenshots of onboarding, sync, backup, goals, rebalance, assistant, and refresh, plus the source provider and credential editors. The native-only behaviors above remain unverified.

## D1 third reviewer pass

- Fixed the phone P&L card overflow and restored even section spacing. The chart now draws to the 18 px card gutter, with localized dates below the canvas. Phone metric values use the system font.
- Applied the phone font to portal overlays. Source rows show a one-line alias above the source type; at 320 px they omit row chevrons to preserve alias width. The source teaser hides when its query is empty or fails.
- Restored the original eight-color desktop chart palette and desktop P&L bar colors. Phone charts use the muted palette, with a distinct sixth color; phone P&L bars update on a live theme change. The Overview CSS targets component classes rather than Tailwind classes or child positions.
- Replaced the blank loading area with a flat hero skeleton and grouped section skeletons. Percent and BTC controls now show switch tracks, and the movers badge uses the same gain/loss pill as the hero.
- Final local checks: frontend and browser-test TypeScript passed, Vitest passed 1,824 tests in 224 files, and the four phone Playwright suites passed 148/148. The browser run regenerated 123 PNGs in `test-results/mobile/`; the 320 px dark P&L and source screenshots were inspected. No iOS simulator or physical device run was performed in this pass.

## D1 second reviewer pass

- Corrected the Overview range cutoff to milliseconds and added a phone browser check that switches to 1W and verifies the chart start and hero change.
- Raised the compact and tab bar fills for readable overlap even when browser blur is unavailable. The loading skeleton now aligns with loaded content; the browser backup indicator clears the tab bar.
- The P&L axis uses Chart.js grace, the scrub chip measures its width before clamping, source rows show type, alias, and logo, and the review fixture uses distinct Bitcoin, Solana, Coinbase, and IBKR sources. Long treemap labels wrap on the narrow phone.
- Pushed page titles appear in the compact bar only after scrolling. Mobile exports now include `Button`, `Switch`, and `MobileNavigation`; More rows have icons. The desktop skeleton pulse and desktop mover selection are restored.
- A broader 62 test phone run initially found one clipped wallet label at 320 px; the wrap fix passed the targeted check. Final local checks passed: frontend and browser TypeScript checks, 1,817 Vitest tests in 221 files, and all 87 tests across the iPhone browser suites. The suite wrote 123 PNGs under `test-results/mobile/`, including light and dark route captures. Browser captures were reviewed at 320 and 390 px. Simulator blur remains unverified.

## D1 reviewer closeout

- CI run `40073503815` on `43e6b9f` passed the iPhone flows but failed 35
  desktop browser checks, mainly from shared accent contrast and the enlarged
  Switch. Its Rust pure tests were skipped. This worktree scopes the iOS
  palette, fonts, Card and Switch to the phone layout and restores the desktop
  defaults. The local desktop browser command passed 77/77 checks,
  including accessibility and density. Later CI run `40076457752` on
  `b9f40ec` passed web and iOS jobs before the second reviewer pass.
- Final local checks for this reviewer pass: frontend and browser test
  TypeScript checks passed; Vitest passed 1,815 tests in 221 files; the
  iPhone Playwright command passed 85/85. These runs do not validate a signed
  physical device.
- Overview review fixes remove the empty chart tick lane, align the plot to
  the content gutter, place date labels closer to the chart, and move the
  touch value chip with a crosshair and point marker. Root tabs no longer have
  a second Track3 bar. First launch hides date and refresh controls until a
  source is configured; More never shows them. Source balances and shares now
  preview the largest three sources.
  P&L copy uses one spelling, signed movers, and grouped allocation quantities.
  The phone screenshots now include touch scrub and loading states. The local
  phone browser command passes 85/85 checks.
- CI run `40070631313` failed two phone viewport checks because the responsive
  P&L chart grew its unbounded flex container. The phone chart now has a fixed
  172 px height. A browser check verifies that the canvas stays that height
  after resize and that the allocation card can be scrolled into view.
- The hero value now outranks the title. The light and dark segmented controls
  have a distinct track and selected thumb. Allocation rows match donut
  colors; the donut shows its total. Movers exclude opposite-sign and duplicate
  rows, use the same stock mark as allocation, and place the view control
  above the net value. Insights use a section header and a currency symbol.
  The extra analytics cards open from a phone inset row.
- The screenshot fixture now follows a varied 60-day trend. The parity suite
  uses it for iPhone SE and iPhone 14 captures and adds dark Overview captures.
  The viewport suite adds light and dark performance and mover captures.
  The completed phone run writes 123 PNGs under `test-results/mobile/`.
  The 320 and 390 px scroll checks passed locally before the second reviewer pass.
- Local checks in this closeout: `tsc --noEmit` passed, 1,815 Vitest tests in
  221 files passed, and all 84 phone Playwright tests passed. Browser captures
  were inspected at 320 and 390 px. These checks do not verify signed-device
  behavior.

## D1 visual foundation, shell, and Overview

- Added [DESIGN.md](DESIGN.md) with the phone color, type, spacing, motion,
  chart, and component rules. Shared phone primitives now expose grouped
  cards and rows, a delta pill, icon button, number animation, skeleton,
  and an illustrated empty state. Phone typography uses system fonts; light
  and dark tokens use grouped white and true-black surfaces with one blue
  accent.
- The phone shell has a blurred tab bar and compact bar, unified navigation
  icons, safe-area spacing, and a compact portfolio total while scrolled.
  The first-launch action opens source setup. System theme changes update
  the theme class without an app restart; the existing manual theme choice
  still takes precedence.
- Overview now presents a large value, a range-filtered trend with touch
  value chip, restrained allocation chart and asset rows, P&L, movers,
  insight, and source balances. Loading uses a reserved skeleton layout.
  The mock screenshot portfolio has seven assets, 60 daily snapshots across
  two months, both positive and negative movers, and a saved insight.
  The 7D and 30D P&L labels replace the old 7T and 30T wording; their
  existing calculations still use historical snapshot offsets.
- Browser screenshots for the Overview and shell are generated in
  `test-results/mobile/` at the compact 320×568 viewport and iPhone 14
  (390×844) in
  light and dark, including scrolled Overview captures. First launch also has
  a light and dark capture at 390 px. The route sweep captures other primary
  routes. Screens owned by the later D2/D3 redesign
  steps still use their existing content styling. Browser screenshots do
  not validate signed-device behavior listed below.
- The original D1 local checks passed before CI run `40070631313`; that run
  exposed the P&L resizing failure described above.

## S5 reviewer closeout

- Pull to refresh now ignores gestures beginning inside a scrolled vertical
  child and is disabled on assistant routes. Vitest and phone browser cases
  cover inner scrolling and the assistant thread.
- Comparison totals use unbroken values and stack the base and head dates
  below 400px. Browser checks cover 320px and 375px widths.
- The More hub receives the unread count from the shell's existing alert
  subscription, avoiding a second badge query and native badge write.
  The goal creation screenshot now scrolls the saved $50,000 rule fully
  into view.
- The round5 desktop density and Vite probe fixes were already present.
  No feature was added in this closeout.
- Local checks passed: both frontend and Playwright TypeScript checks,
  1,803 Vitest tests in 218 files, 81 mobile-suite Playwright tests, and 61
  Rust pure tests. The frontend production build passed. The three
  regenerated goal screenshots show the saved $50,000 rule; the iPhone SE
  image was visually inspected.
- The latest successful iOS foundation run on the S4 head `660e9bf` was
  `40002540819`: both web and iOS jobs passed. Run `39998981335` on the
  same head also passed both jobs, with 1,802 Vitest tests, 77 phone and
  77 desktop Playwright tests, and 61 Rust pure tests. Its simulator showed
  a rendered empty Overview and a readiness marker, and it uploaded the
  unsigned builds and 82 phone browser screenshots. An intervening attempt,
  `40002534459`, timed out installing Ubuntu packages in the web job;
  its iOS job passed. The separate `test-on-pr` run `40002541174` passed.
  These are S4-head results; S5 has no pushed CI run yet.
- Signed physical-device checks listed in S4 remain open.

## S4 integration, parity and release preparation

- The S2 More tab now opens the S3 iPhone Settings hub. Its section links,
  direct hash routes, Back stack, and page titles are exercised in browser
  tests. Settings, Goals and Rebalance have one visible page heading. The
  shared S2 phone row is used in Settings; S3's duplicate row was removed.
  Full-screen editors and confirmation sheets share
  `src/mobile/components/mobile/overlays.tsx` and mount at the document root, so
  the shell header cannot sit above a source editor. Focused Settings pages
  rely on the shell's single Back button.
- The iPhone haptic hook calls the S3 native bridge. The assistant composer
  measures the space above the tab bar as the visual viewport changes. The
  iOS share command accepts the UUID cache folder and export filename
  created by the JavaScript export flow, while rejecting unrelated paths.
  The main-content back swipe now uses touch pointer events so the gesture
  survives Chromium's canceled touch sequence; swipes inside modal editors
  leave the form open. The initial goals query no longer closes an editor
  opened before loading finishes. The phone chat header wraps without
  overlapping usage controls, and the shell shows one Back control.
  Wallet chart components import their analyzer directly, removing Rollup's
  circular chunk warning.
- Reviewer follow-up removes duplicate shell safe-area padding. The header,
  content and tab bar now own their insets, with a browser regression that
  injects nonzero top and side insets. The More Goals row shows its unread
  alert count. Startup portfolio read failures show a persistent retry toast.
  Rebalance now uses the shell's touch-width signal for its phone controls.
- [FEATURE_PARITY.md](FEATURE_PARITY.md) inventories the desktop routes,
  Settings controls, data sources, charts and assistant skills with iPhone
  locations and test references. The README and
  [RELEASE.md](RELEASE.md) describe builds, signing, privacy, platform
  limits and device checks. Desktop updater, window controls, tray and
  external digital subscription checkout have justified iOS exclusions.
- The new Playwright suite checks iPhone SE, 14 and Pro Max viewports,
  navigation, first launch, source creation, refresh, Files flows, goal
  creation, rebalance, chat, language/theme, overflow, safe-area spacing,
  tab touch targets and browser errors. The primary flows run at all three
  sizes, and disclosure and form-label targets are checked at 44px.
  A configured but locked sync pill clears the More tab. The Xcode target
  now supports iPhone only; iPad has no validated layout. It saves screenshots in
  `test-results/mobile/`. CI now installs cached Chromium and runs the
  mobile suites, browser typecheck and Rust pure tests.
- Run `39988241737` on head `5d5d18b` passed both jobs. The simulator app
  launched with a rendered empty Overview and a ready marker; native symbols,
  the committed Xcode project and unsigned IPA passed. The web job passed
  TypeScript, 1,800 Vitest tests in 218 files, 76 iPhone Playwright tests,
  77 desktop Playwright tests and 61 Rust pure tests. Simulator screenshots
  and build artifacts uploaded. Browser screenshots were not uploaded because
  the desktop Playwright run cleared their output directory; the upload step
  is now immediately after the iPhone run and awaits CI verification.
- The README now discloses Aptabase telemetry on iPhone. The release
  checklist requires App Store privacy labels and an accurate
  `PrivacyInfo.xcprivacy` manifest; both remain release tasks. The release
  checklist also flags the existing Pro license-key flow as an unresolved
  App Store Guideline 3.1.1 review risk. Browser tests now save an exchange
  and wallet at all three iPhone sizes and collect page and console errors
  across the mobile route suite.
- A signed physical-device run remains necessary for Face ID/Touch ID
  and passcode fallback, Keychain migration and restore, app-switcher cover,
  notification delivery and badge, haptics, share sheet, Files/iCloud Drive,
  keyboard movement and iOS background suspension. Browser mocks and the
  unsigned simulator cannot establish those behaviors.

### S4 local verification

- `corepack yarn tsc --noEmit` and
  `corepack yarn tsc -p tests/e2e/tsconfig.json --noEmit` passed in this
  reviewer follow-up. Full Vitest passed: 1,802 tests in 218 files.
  The three iPhone Playwright files passed 77/77, including the injected
  nonzero safe-area regression. The narrow desktop rebalance browser check
  passed 1/1. After the density test fix, its 12 tests passed three times
  each, and the CI desktop browser command passed 77/77 locally.
  Playwright saved phone screenshots during the mobile run; the later
  desktop check cleared the local `test-results/` directory as expected.
- `corepack yarn build` passed after these fixes. The seven-route production
  preview passed before this review follow-up. `cargo test --locked -p track3-pure-tests --lib`
  passed 61 tests in this follow-up; no Rust code changed in it.
  The full Vitest suite emits expected jsdom canvas and intentional
  error-boundary messages while exiting successfully. Workflow YAML parsed.
- Run `39993408716` on head `49dc2f3` passed the macOS iOS job, including
  simulator launch, screenshots and unsigned IPA. Its web job failed in the
  desktop density test because Chromium measured a 36px tab as 36.000015px;
  the later Rust checks were skipped. The S4 follow-up reduced motion and
  rounded pixel measurements in that test, and set the Playwright server's
  readiness probe variable to stop Vite's repeated warning. The later
  successful runs on `660e9bf` are recorded in S5 above. No signed-device
  claim is made from the local checks.

## S1 foundation

- Last pushed run `39932803896` failed in both jobs. The web job could not
  install `libwebkit2gtk-4.0-dev` on Ubuntu 24.04. The iOS job built and
  passed both Rust target checks, then showed a blank white simulator
  screenshot and timed out waiting for the frontend readiness marker. WebKit
  loaded the page assets, but the available log did not show JavaScript
  errors. The run uploaded no artifacts.
- This round removes the obsolete 4.0 package from the foundation workflow,
  lets the readiness probe recognize a fresh install's empty portfolio, adds
  an app error screen and startup JavaScript error capture, and checks the
  initial simulator screenshot. The workflow now attempts to upload the
  simulator `.app`, unsigned `.ipa`, screenshots, and logs on every run.
  Artifacts uploaded successfully in the later S4 run `39981443802`.
- A local production build reproduced the blank page: a circular Vite manual
  chunk made `vendor-charts` read React before initialization. Removing that
  chunk rule removed the circular import. At an iPhone viewport the rebuilt
  bundle has no JavaScript page error; the production Playwright portfolio
  smoke test passes with its Tauri bridge fixture.
- Local `corepack yarn tsc --noEmit` and the probe-enabled frontend build
  passed. `corepack yarn vitest run` passed (1,723 tests in 203 files).

The S1 simulator exit condition was met by run `39981443802` on `dde653d`.
Physical device and signed build checks remain pending.

## S2 mobile shell and data screens

- Added the phone shell with four bottom tabs, per-tab back navigation,
  including stock asset query parameters, collapsing titles, a compact
  portfolio total, safe-area spacing, pull to
  refresh through the existing refresh flow, and a floating source-status
  sheet. Desktop routing remains available.
- Added reusable touch components in `src/mobile/components/mobile/`; their usage
  contract is in `docs/ios/MOBILE-UI.md`. History, comparison, cost basis,
  coin transactions, wallet analytics, and attribution now show phone rows,
  sheets, or date inputs instead of wide tables and popovers. Overview
  rankings and shared dialog styles fit phone widths. Comparison ranges
  support horizontal swipes; finance charts accept touch inspection.
- Local checks passed before review: `corepack yarn tsc --noEmit`; Vitest
  (205 files, 1,736 tests); Playwright mobile suite (18 tests); Rust pure tests
  (60 tests). Playwright saved 28 route screenshots in `test-results/mobile/`
  at 320, 375, 390, and 430 CSS pixels. Each route check waits for content
  to load, then asserts no document overflow or clipped visible leaf text
  and checks bottom safe-area clearance.
- Review follow-up: iOS foundation run `39944121990` built but failed at
  simulator launch. Its stack traced to formatting Invalid Dates on an empty
  database. Fresh portfolios now receive an empty date range, and date range
  persistence checks validity before formatting. The iOS error report now
  includes the message. A new app render test covers the empty portfolio.
- Viewport screenshots now use viewport capture; full-page capture made
  Chromium switch to desktop layout during screenshot. The route loop also
  visits More and Goals, and the history list gets a scrolled screenshot.
  History swipe actions handle canceled pointers, leave the tab order while
  concealed, and suppress the accidental row tap after a swipe. The suite
  exercises swipe, delete confirmation, and undo. History pagination stays
  together at phone width. The Pro header total polls, pull to refresh awaits
  the actual refresh promise, and the portfolio change value can be toggled
  by touch. The allocation chart accepts nearby taps.
- Review follow-up local checks passed: `corepack yarn tsc --noEmit`;
  Vitest (207 files, 1,743 tests); Playwright mobile suite (21 tests).
  The final Playwright run saved 40 viewport screenshots in
  `test-results/mobile/` at 320, 375, 390, and 430 CSS pixels. Live DOM
  metrics check overflow, clipped text, tab visibility, and safe-area
  clearance; a 390pt history screenshot and a 320pt scrolled history-list
  screenshot were visually inspected.
- The run also hit GitHub Actions artifact storage quota when uploading
  simulator evidence and unsigned builds. Upload failure is now nonfatal so
  the next job can report the simulator result independently. Artifact
  retention remains unavailable until GitHub recalculates or frees quota.
- CI run `39949174467` built and launched the simulator app and built the IPA,
  but its final generated Xcode project diff check failed. This follow-up
  matches the two generated files to that exact CI diff. The mobile shell now
  covers coarse-pointer landscape widths through 950px, avoids a second
  hidden Pro total poll, and exposes the last refresh time while pulling.
  Finance charts gate touch drags behind a long press and allow vertical page
  scrolling. The toast close control is visible, named, and 44px wide on
  touch screens. History has one mobile `h1`; the More settings link uses its
  canonical route so Back returns through configuration to More.
- This follow-up passed `corepack yarn tsc --noEmit`, Vitest (207 files,
  1,745 tests), and the full mobile Playwright suite (24 tests). Playwright
  saved 40 PNGs in `test-results/mobile/`; all have the expected dimensions.
  The route sweep checked overflow, clipped text, tab visibility, and
  injected safe-area clearance at 320, 375, 390, and 430 CSS pixels.
- Reviewer follow-up: the Xcode project check now restores the committed
  variable based `Info.plist` and its trailing newline after Tauri rewrites
  the file. Portal sheet gestures no longer trigger page refresh or swipe-back.
  Sheet detents track the handle during a drag. Phone data routes have one
  `h1`, history rows retain logo previews, mobile inputs use at least 16px
  text, and `/more` renders on desktop.
- Local checks after this follow-up passed: `corepack yarn tsc --noEmit`;
  Vitest (208 files, 1,748 tests); Playwright mobile suite (26 tests).
  The four viewport sweeps regenerated 40 PNGs in `test-results/mobile/`
  and checked width, clipped text, tab visibility, and safe-area clearance.
  The comparison sheet tests cover portal drag isolation and both detents.
- Reviewer follow-up: pushed routes now open at the top, the sticky header
  keeps Back visible, and tab switches restore their saved scroll position.
  Tapping the active tab returns to its root or scrolls that root to the top.
  The Analytics root links to Wallets, Comparison, and Cost basis; More keeps
  its own routes. The latest history snapshot has a visible delete action in
  its detail. Phone gestures are gated by the mobile media query, and touch
  icons remain visible on wider touch displays. Locale keys added for S2
  are at the end of both files, and the duplicate empty-date guard was removed.
  This review explicitly requested that correction in S3-owned
  `configuration.ts`. The existing S2 edits to S3-owned `refresh-data.tsx`
  register the pull-to-refresh callback and its loading guard; the driver
  should reconcile them with S3 before merging.
- macOS CI run `39957522652` passed on the previous HEAD. This follow-up
  still needs a new CI run after the driver commits and pushes it.
  Local checks for this follow-up passed: `corepack yarn tsc --noEmit`,
  Vitest (208 files, 1,748 tests), and Playwright mobile (31 tests).
  Playwright regenerated 40 PNGs under `test-results/mobile/`; all have
  the expected 2x dimensions, and the route sweep checked horizontal
  overflow, clipped text, tab visibility, and safe-area clearance.
  Physical-device interaction checks and a native haptic bridge remain pending. The
  shared haptic hook uses vibration where a WebView supports it; WKWebView
  needs a native bridge for physical feedback. S3-owned screens will need
  to adopt the shared phone components.

## S3 feature screens and native integrations

The S2 shell and S3 screens are now combined in this worktree. Native behavior
still needs signed-device validation. The S3 iOS run `39951716004` failed
the committed-project check; the later S4 run `39969080654` passed it.

- iPhone Settings now opens focused pages for data sources, base currency,
  appearance, language, blacklist, Pro, assistant configuration, security,
  backup, sync, and About. Desktop settings retain their existing layout.
  `src/mobile/components/mobile/` provides the page, row, and overlay patterns.
- Exchanges, wallets, IBKR Flex, and custom holdings have phone source lists
  and full-screen add/edit forms. Provider selection precedes credentials;
  credential fields suppress autocorrection and mask secrets. Existing source
  validators, Pro gating, attachments, and quick views remain connected.
  Source deletion and backup restore use confirmation sheets.
- Backup settings keep Files import/export and the existing automatic backup
  format. iPhone export also opens the native share sheet. Automatic backups
  use Track3's Documents directory, which S1 exposes in Files, including
  iCloud Drive when the user moves files there. Alerts use the existing local
  notification permission flow and now update the app icon badge.
- The assistant has a full phone chat and session view with a composer that
  follows the visual viewport above the keyboard and collapsed tool activity.
  Alert editing uses a focus-trapping page with background scroll locked.
  Rebalance targets have touch sliders and 44 pt increment and decrement
  buttons; detailed iPhone results are cards instead of a wide table.
  refresh opens a progress sheet with existing source status and retry.
  The backup status is visible without hover.
- A small Swift bridge supplies Face ID, Touch ID, or device passcode app
  lock, an opaque app-switcher privacy cover, haptics, badge updates, and the
  iOS share sheet. The persistent encryption key now lives in a
  device-only iOS Keychain item. Existing protected `.ent-key` files migrate
  to Keychain on launch; key rotation and recovery now use the Keychain item.
  The rotation journal can temporarily contain key material during a crash
  recovery and remains protected and excluded from backup by S1's file policy.
- The Swift lock prompts after entering the background, covers the app
  switcher snapshot whenever activity resigns, even when app lock is off,
  and no longer reacts to keyboard windows. A device without an available
  passcode policy disables the lock
  and shows an explanation. The Rust iOS cdylib permits the Swift symbols to
  resolve at the final app link; the CI build now checks the final executable
  for every native bridge symbol. The Swift typecheck step is appended after
  the iOS build and artifact steps. A newly visible app window now receives
  the cover before an unlock prompt, and a timed-out settings prompt
  invalidates its authentication context. Badge updates use
  `UNUserNotificationCenter.setBadgeCount` on iOS 16 and newer; the installed
  notification plugin requests badge, alert, and sound permission together.
- Editing a saved source keeps its attachment identity fixed. The alert
  editor has a Cancel button, and refresh hides old source results until the
  current run finishes.
- The current review removes the blocking Keychain retry loop and fabricated
  simulator signature. A simulator lacking Keychain entitlement uses a
  protected, backup-excluded key file. Other startup key errors leave Track3
  locked with the database closed instead of panicking; a temporary key error
  retries when the app becomes active or the user taps Retry. CI prints recent
  crash details in the job log; upload quota errors no longer mask the launch
  result. Mobile dialogs trap focus, lock background scrolling, and dismiss
  through Escape or a backdrop tap. Changing a new exchange's provider clears
  its old password and passphrase. The iPhone Pro page keeps license entry
  but hides external subscription links. The share sheet preserves the
  export filename by staging it in a private UUID directory as
  `track3-export-data.json`. The System theme choice is limited to iOS.

### Remaining S3 work and verification limits

- Wallet QR scanning is not implemented. Users can type or paste addresses;
  camera permission is not requested.
- Automatic backup and refresh run while the app is active. iOS can suspend
  WKWebView work in the background, so scheduled execution after suspension
  is not guaranteed; no BGTaskScheduler integration exists.
- Keychain migration, native lock, privacy cover, badge, haptics, share sheet,
  Files visibility, and background behavior still need physical-device
  checks. In particular, cold-start lock coverage must be
  checked on a device after launch with lock enabled. The S4 simulator
  screenshot verifies launch and empty Overview, but cannot establish the
  signed-device behaviors above. A Keychain failure leaves the portfolio
  locked; the debug startup log reports its OSStatus.

### S3 local checks

- `corepack yarn tsc --noEmit` passed after the current review fixes.
- `corepack yarn vitest run` passed: 1,771 tests in 212 files, including
  English/Chinese catalog parity.
- `E2E_PORT=1423 corepack yarn playwright test
  tests/e2e/ios-settings.spec.ts --workers=1` passed: 14 browser checks at
  375, 390, and 430 pixel widths. It covers the remaining settings pages,
  assistant composer, alert editor, rebalance cards with data, and refresh
  sheet.
- Previously, `cargo test --locked -p track3-pure-tests --lib` passed: 60
  tests. It was not rerun for this review pass.
