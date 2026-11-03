# refresh-states · phone

References viewed: `phone/flows/refresh-states-phone.jpg`, `source/ds/pages/flows-refresh.html#states`, `ds/ds.css`, `ds/ds.js`, `ds/BRIEF.md`, and `core-navigation-map.html`.
Source viewport: 390 × 844 dark; document height 2447px. Palette: ground #0d0d0e, card #131217, border #222224, rule #1b1a1f, accent #4a8ad6, positive #5fc39c, negative #ee6a82, warning #d9a441. Public Sans with tabular figures.

## Structure and exact copy

- **div.head** x16 y14 358×98; font 13px/18px/400; padding 0px; radius 0px; text rgb(255, 255, 255); fill rgba(0, 0, 0, 0). FlowsRefresh statesThe control in the Overview header, and what it says in each state.
- **section.card.s12** x16 y128 358×1435; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). StateControlStatus textBehaviourIdleRefreshSynced 09:41 · on this deviceRefresh starts all active sources in parallel. Inactive sources are skipped.RefreshingRefreshing · 3 of 5 finishedUpdating totals when 5 of 5 finishButton stays enabled: it opens the progress popover. Totals keep the last complete value and are marked while running.DoneRefresh5 of 5 refreshed at 09:41Popover closes itself after 2 s unless the pointer is inside. Toast: Refresh complete.Partial failureRefre
- **section.card.s6** x16 y1575 358×333; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Per-source statusin popover, Sources card and phone sheet BnBinanceDone in 3.1 sLgLedger cold walletReading balancesOKOKXRequest timed out after 20 sRetry0x0x4f…a91cPro limit reached: 50 of 50 ERC20 refreshes used, resets 1 NovManage plan
- **section.card.s6** x16 y1920 358×439; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Rules A failure names its reason. Plain words and the number that matters (20 s, 50 of 50). No raw stack in the row; Copy diagnostics lives in the sync popover. Retry is per source. Retry on a row, Retry failed in the popover footer, and Retry in the banner re-run only failed sources; finished ones keep their values. Colour carries state, text carries meaning. Red for a failed request, amber when the action is on the user (quota, key, limit). Offline is not failure. With no n

## Interactive controls and states

- button.btn.rf x33 y184 100×44; Refresh. 13px/18px/500; radius 999px.
- button.btn.rf.busy x33 y350 238×44; Refreshing · 3 of 5 finished. 13px/18px/500; radius 999px.
- button.btn.rf x33 y535 100×44; Refresh. 13px/18px/500; radius 999px.
- button.btn.rf x33 y701 100×44; Refresh. 13px/18px/500; radius 999px.
- button.btn.rf x33 y885 100×44; Refresh. 13px/18px/500; radius 999px.
- button.btn.rf x33 y1069 100×44; Refresh. 13px/18px/500; radius 999px.
- button.btn.rf x33 y1253 100×44; Refresh. 13px/18px/500; radius 999px.
- button.btn.rf.primary x33 y1419 128×44; Refresh now. 13px/18px/500; radius 999px.
- button.btn.sm x301 y1773 56×44; Retry. 12px/16px/500; radius 999px.
- button.btn.sm x259 y1836 98×44; Manage plan. 12px/16px/500; radius 999px.

## Original capture and pixel difference

Authoritative source render: `/tmp/fidelity/flows/design-refresh-states.png`. No matching product app capture or meaningful pixel ratio; reason below.

## Remaining differences

- This reference juxtaposes multiple mutually exclusive refresh states in one catalogue. The product displays one live state at a time, so no single real app capture matches it.
