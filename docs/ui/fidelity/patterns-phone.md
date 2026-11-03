# patterns · phone

References viewed: `phone/flows/patterns-phone.jpg`, `source/ds/pages/flows-patterns.html`, `ds/ds.css`, `ds/ds.js`, `ds/BRIEF.md`, and `core-navigation-map.html`.
Source viewport: 390 × 844 dark; document height 5545px. Palette: ground #0d0d0e, card #131217, border #222224, rule #1b1a1f, accent #4a8ad6, positive #5fc39c, negative #ee6a82, warning #d9a441. Public Sans with tabular figures.

## Structure and exact copy

- **div.head** x16 y14 358×116; font 13px/18px/400; padding 0px; radius 0px; text rgb(255, 255, 255); fill rgba(0, 0, 0, 0). FlowsPatternsLoading, error, stale and empty states, and the toast catalogue. Every block keeps its frame and says what to do next.
- **section.card.s8** x16 y248 358×419; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Portfolio valueChart
- **section.card.s4** x16 y679 358×366; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). SourcesList
- **section.card.s8** x16 y1057 358×343; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). HoldingsTableAssetPriceValue7D
- **section.card.s4** x16 y1412 358×296; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). RulesTitles and column heads are real. Only data is a placeholder.Same heights as loaded. Nothing jumps when data arrives.Wait 150 ms first. Local reads that finish faster show no skeleton at all.After 10 s the header line changes to “Still loading” with a Retry link.Announced. The grid carries aria-busy, so screen readers hear one loading message, not blocks.
- **section.card.s8** x16 y1804 358×386; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Portfolio valueUSDCould not update the chartThe request for price history timed out after 20 s.Showing data from 30 Oct 21:14RetryDetails
- **section.card.s4** x16 y2202 358×386; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). SourcesSources did not loadThe local database was busy. Try again in a moment.Showing data from 30 Oct 21:14RetryDetails
- **section.card.s8** x16 y2666 358×584; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Showing data from 29 Oct 09:41.The last refresh was more than 24 hours ago. Totals may differ from the market.Refresh You are offline.Showing values from 09:41. Refresh turns on again when the connection returns; local data and History still work. Sync is locked.Enter your passphrase to resume syncing. Track3 keeps working on this device.Unlock Could not reach 3 of 5 sources.Binance, OKX and Interactive Brokers did not respond. Totals exclude them.Retry
- **div.banner.warn** x33 y2683 324×138; font 13px/18px/400; padding 12px 14px; radius 6px; text rgb(217, 164, 65); fill rgb(42, 36, 22). Showing data from 29 Oct 09:41.The last refresh was more than 24 hours ago. Totals may differ from the market.Refresh
- **div.banner** x33 y2833 324×100; font 13px/18px/400; padding 12px 14px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). You are offline.Showing values from 09:41. Refresh turns on again when the connection returns; local data and History still work.
- **div.banner.info** x33 y2945 324×138; font 13px/18px/400; padding 12px 14px; radius 6px; text rgb(255, 255, 255); fill rgb(20, 36, 58). Sync is locked.Enter your passphrase to resume syncing. Track3 keeps working on this device.Unlock
- **div.banner.err** x33 y3095 324×138; font 13px/18px/400; padding 12px 14px; radius 6px; text rgb(255, 255, 255); fill rgb(44, 26, 32). Could not reach 3 of 5 sources.Binance, OKX and Interactive Brokers did not respond. Totals exclude them.Retry
- **section.card.s4** x16 y3262 358×301; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Freshness stampFreshUnder 1 hourSynced 09:41Aging1 to 24 hoursRefreshed 6 hours agoStaleOver 24 hoursLast refreshed 29 Oct 09:41OfflineNo networkOffline · last refresh 09:41
- **section.card.s8** x16 y3641 358×244; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Portfolio valueUSDNo snapshots in this rangeTry a wider range to see your history.Show 1Y
- **section.card.s4** x16 y3897 358×244; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). TransactionsBTCNo transactions in this rangeBuys, sells and transfers appear here.Show all time
- **section.card.s4** x16 y4255 358×178; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Success4 sSnapshot saved5 of 5 sources refreshed at 09:41.
- **div.toast.ok** x33 y4304 324×62; font 13px/18px/400; padding 12px 14px; radius 8px; text rgb(255, 255, 255); fill rgb(27, 26, 32). Snapshot saved5 of 5 sources refreshed at 09:41.
- **section.card.s4** x16 y4445 358×178; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Info5 sNext backup 1 NovSaved to Documents/Track3.
- **div.toast** x33 y4494 324×62; font 13px/18px/400; padding 12px 14px; radius 8px; text rgb(255, 255, 255); fill rgb(27, 26, 32). Next backup 1 NovSaved to Documents/Track3.
- **section.card.s4** x16 y4635 358×190; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Warning8 sPro refresh limit nearly used48 of 50 ERC20 refreshes used. Resets 1 Nov.See usage
- **div.toast.warn** x33 y4684 324×124; font 13px/18px/400; padding 12px 14px; radius 8px; text rgb(217, 164, 65); fill rgb(27, 26, 32). Pro refresh limit nearly used48 of 50 ERC20 refreshes used. Resets 1 Nov.See usage
- **section.card.s4** x16 y4837 358×194; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). ErrorUntil dismissedOKX refresh failedRequest timed out after 20 s.RetryDetails
- **div.toast.err** x33 y4886 324×106; font 13px/18px/400; padding 12px 14px; radius 8px; text rgb(255, 255, 255); fill rgb(27, 26, 32). OKX refresh failedRequest timed out after 20 s.RetryDetails
- **section.card.s4** x16 y5043 358×194; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). With action8 s, paused on hoverSnapshot deleted30 Oct 21:14 removed from History.Undo
- **div.toast** x33 y5092 324×106; font 13px/18px/400; padding 12px 14px; radius 8px; text rgb(255, 255, 255); fill rgb(27, 26, 32). Snapshot deleted30 Oct 21:14 removed from History.Undo
- **section.card.s4** x16 y5249 358×208; font 13px/18px/400; padding 16px; radius 6px; text rgb(255, 255, 255); fill rgb(19, 18, 23). Long error, clampedUntil dismissedSync upload failedPutObject to bucket track3-dom returned 403 SignatureDoesNotMatch: the request signature we calculated does not match the signature you provided. Check your secret access key and path-style setting, then try again from Settings, Backup and sync.Copy detailsDetails
- **div.toast.err** x33 y5298 324×142; font 13px/18px/400; padding 12px 14px; radius 8px; text rgb(255, 255, 255); fill rgb(27, 26, 32). Sync upload failedPutObject to bucket track3-dom returned 403 SignatureDoesNotMatch: the request signature we calculated does not match the signature you provided. Check your secret access key and path-style setting, then try again from Settings, Backup and sync.Copy detailsDetails

## Interactive controls and states

- button.btn.sm x130 y2057 56×44; Retry. 12px/16px/500; radius 999px.
- button.btn.sm.ghost x196 y2057 64×44; Details. 12px/16px/500; radius 999px.
- button.btn.sm x130 y2455 56×44; Retry. 12px/16px/500; radius 999px.
- button.btn.sm.ghost x196 y2455 64×44; Details. 12px/16px/500; radius 999px.
- button.btn.sm x78 y2764 264×44; Refresh. 12px/16px/500; radius 999px.
- button.btn.sm x78 y3026 264×44; Unlock. 12px/16px/500; radius 999px.
- button.btn.sm x78 y3176 264×44; Retry. 12px/16px/500; radius 999px.
- button.btn.sm x159 y3784 73×44; Show 1Y. 12px/16px/500; radius 999px.
- button.btn.sm x145 y4040 101×44; Show all time. 12px/16px/500; radius 999px.

## Original capture and pixel difference

Authoritative source render: `/tmp/fidelity/flows/design-patterns.png`. No matching product app capture or meaningful pixel ratio; reason below.

## Remaining differences

- This is a design-system catalogue rather than a navigable product screen. No real app route exposes it, so there is no faithful product fixture or app capture.
