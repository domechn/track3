# History detail · phone fidelity specification

Source: `phone-long/records/history-detail-phone-long.jpg`, `phone/records/history-detail-phone.jpg`, and the HTML/CSS/JS under `/home/ubuntu/.hermes/projects/track3-design/source/ds/`. Measurements are Chromium style and bounds at 390 × 844 CSS pixels.

## Structure and measurements

- This is a full page detail above the fixed 60 px bottom navigation, on `--ground` #0d0d0e, 16 px side margins. The design detail content starts at x16 y26. No list header or filter chips appear here.
- Header: 44 × 44 circular outlined back button, 10 px gap, “28 Oct 2026, 08:51” at 17/24 weight 600, and an 18 px high blue “Edited” pill. Back returns to History.
- KPI group starts at y84 and is 149 px tall: “Total value”, “$752,642.71”, “Includes 2 edits”; a hairline divider, then side-by-side Change “−$40.86”, “−0.01% vs 27 Oct” and Assets “8”, “5 of 5 sources”. Labels are 12/18 `--faint`; values 17/22 weight 500. The change uses `--negative` #ee6a82.
- Actions at y249: outlined pill Compare and View assets on a shared row, each at least 44 px high; outlined red Delete on the next row. Their labels use 12/16 weight 500. The Edited pill begins at x241. Trash, down chevron and compare icons are simple strokes. A separator follows the actions.
- “Assets at that time” with right aligned “8 assets”. Eight 64 px rows in descending value order: BTC $200,519.26, USDT $182,410.25, ETH $148,030.18, SOL $66,551.20, BNB $48,727.23, USDC $39,853.99, AAPL $35,700.00, NVDA $30,850.60. Row line 1 is symbol weight 700 and right aligned value weight 500; line 2 is quantity × price · percentage in `--faint`. Edited USDC quantity and AAPL price are blue, with gray “was …”. A “Total” row follows. Rows use `--rule` #1b1a1f separators, 12 px vertical padding.
- “Edits” section follows with “2 edits · changes the total by +$103.49”, then AAPL price and USDC quantity changes with edit time and before → after. “Sources” follows with “All 5 refreshed”, five source rows, green status dot, source name and right aligned value. Section headings use 15/20 weight 600.
- Source bounds at 390 px: the Assets KPI text begins at x146; the Total text begins at y943.5; Edits heading begins at y1017 and the first edit row at y1043. The phone implementation uses these bounds and the source's 64 px Total row.
- Partial status lists only known refresh data. The asset list remains bounded for large snapshots and exposes a search if required. The supplied detail state has no hide-values control; the existing comparison-page masking remains on its own route.
- Detail keeps the selected row's change and Edited status when an external data update resets the list to its first page. A zero previous total displays a finite 0.00% change, matching the guarded list calculation.
- In light theme, the detail ground, title, actions, delete sheet and tab bar use the same scoped theme tokens as the History list. The title and action text retain at least 4.5:1 contrast.

## Product data constraints

Stored assets supply symbol, quantity, price and value. A local `price` edit changes a transaction, not the snapshot asset price; local asset edits are delete or restore records with JSON values; import replacement records use a snapshot summary and have no symbol. The phone detail shows those records through the existing edit log and does not attach transaction changes to an asset valuation or calculate an unsupported total delta. Complete snapshots do not store named source refresh status. Portfolio source configuration can give names, but the snapshot record does not prove every source refreshed. The design's “Compare” selection uses the existing comparison route. The product has asset delete and edit history but no snapshot editing screen; “View assets” scrolls to the asset list. On opening detail, keyboard focus moves to Back; Escape and Back return focus to the opening row.

## Remaining differences

The HTML source page is present at `/home/ubuntu/.hermes/projects/track3-design/source/ds/pages/`. On 8 Nov 2026 it was re-rendered at 390 × 844 in Chromium with scrollbars hidden. `getBoundingClientRect()` places its detail at (16, 26) with width 358 px; `getComputedStyle()` reports 13/18 px text. The eight-asset branch capture before this merge in `/tmp/ui43-captures-phone/history-detail-phone.png` differs from `/tmp/ui43-source/records-history-detail-390x844.png` by **4.10%** of viewport pixels whose summed absolute RGB difference exceeds 48. The source full page is 1486 px tall; the app's fixed shell scrolls within its main area, so its `fullPage` screenshot captures only the 844 px viewport. The source's named Sources rows also cannot be represented with stored snapshot data, as explained below.

The prior 8 Nov app viewport capture in `/tmp/fidelity/history-detail/history-detail-phone.png` differs from the Chromium source render in `/tmp/fidelity/source-review/records-history-detail.png` by **4.22%** at the same size and threshold. The shared selected tab treatment, absent from the static source, raised the earlier 1.85% ratio.

Remaining visible differences, with product reasons:

- The active History tab keeps the app-wide tinted background and indicator; the source has only an active icon.
- Asset rows use the current shared AssetIcon marks, which differ from the older source art while preserving the stored ticker and type.
- “5 of 5 sources” beneath Assets and the entire named Sources section are absent. Complete snapshots do not store per-source names, values, or refresh outcomes, so current configuration cannot reconstruct those historical facts.
- “View assets” and its down chevron replace the source's “Edit” button and pencil. They accurately describe the available shortcut because the product has no snapshot editor. Existing per-asset actions remain available.
- The source's blue asset values with “was …” and the “changes the total by …” summary require per-field asset edits that the product does not store. The app shows a transaction price edit and a symbol-free imported replacement in the general log, with “2 edits” in the heading and no invented total delta.
- The AAPL price edit matches the source label, value and time. The second stored record is an imported snapshot replacement rather than the source's invented USDC quantity edit, so its label and values differ. Both sides of its summary use the selected currency and cents, and the text wraps within the card.
- The phone detail retains the shared sync lock/status control so the existing unlock and sync flow remains reachable and its state visible; the reference has no sync control.
- A real 47-asset snapshot initially shows 12 assets, section chips, and a Show all control. The supplied source detail contains eight assets and has no corresponding large-snapshot screen.
