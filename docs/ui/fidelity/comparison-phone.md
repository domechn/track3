# Comparison · phone

References viewed: `phone/analyze/comparison-phone.jpg`, `phone-long/analyze/comparison-phone-long.jpg`, `source/ds/pages/analyze-comparison.html`, `analyze-comparison.js`, `analyze-data.js`, `lib.js`. 390px dark design: ground `#0d0d0e`, card `#131217`, border `#222224`, rule `#1b1a1f`, blue `#4a8ad6`, gain `#5fc39c`, loss `#ee6a82`. Public Sans body 13/18, title 22/28 semibold, card headings 15/20 semibold, stats 22/28 medium. Cards x16 w358, 16px internal padding, 6px radius, 12px vertical gap.

## Structure

1. Title Comparison x16 y14. Three-line subtitle y44: `What changed between two snapshots? +$34,641.48 (+4.75%) from 1 Oct to 31 Oct; BTC and ETH made 68% of it.` Emphasize the money. No visible header actions.
2. Snapshots card x16 y124 h531. Snapshot A picker button: clock icon, `1 Oct 2026`, `09:41 · $729,168`, chevron. Snapshot B: `31 Oct 2026`, `09:41 · $763,809`. Labels above. `Quick range ending at B` with two-column 44px pills Yesterday, 7 days, **30 days** blue selected, Start of month. Rule and two-column, two-row KPI grid: Value at A · 1 Oct `$729,167.79` / Snapshot 09:41; Value at B · 31 Oct `$763,809.27` / 30 days later; Change `+$34,641.48` / absolute; Change % `+4.75%` / vs 1 Oct.
3. Per asset starts at x16 below Snapshots and grows with the available assets, sorted by absolute change. Each compact row shows held quantity, A→B price, change percent, and A→B value. The total row follows the assets; the blue info banner appears when saved amounts are equal.
4. Biggest movers by value and percentage follow Per asset in separate growing cards. Both rank by absolute change magnitude and display the sign in the value column. The 11-asset review fixture begins BTC `−$318,305`, BNB `−$35,571`, USDT `−$4,000` by value and BNB `−6.92%`, PLUME `−6.92%`, ETH `−5.19%` by percentage. Each card initially shows ten 44px rows; `and 1 more` reveals USD. Columns and the zero axis align across each card. At 390px the percentage card hides the absolute-change column. The computed notes say `BTC and BNB made 99% of the total change` and `SCHD rose most in relative terms; USDT moved −2.23%.` Hide-values changes the expansion label to `Show More` without a count.

## Interactive and data rules

Both pickers open a calendar of real stored snapshots. Quick ranges choose the nearest available real prior snapshot ending at B. Comparison details derive from both stored asset sets; value masking leaves unit prices visible, and quote-color configuration applies. The price-only banner appears only when all quantities are equal. Preserve the sparse-month unknown-profit behavior.

The compact hide-values icon has a 44 × 44px touch box while keeping the reference's visible icon position.

## Original capture

Fresh 390 px dark full-page renders of the source HTML and app with the source's eight assets measure 2603 and 2647 px high. The default state differs at **6.04%** of pixels with any RGB channel above 20, or **4.74%** above 60. The picker viewport differs at **5.89%** and **2.36%**, respectively. The captures and `getBoundingClientRect`/`getComputedStyle` measurements are in `/tmp/ui14-current/`. The source cannot display the required 11-asset state, so these ratios compare the same eight-asset data on both sides.

## Remaining differences

- The source ranks mover rows by signed change, uses 40–42 px rows and fixed 435/469 px cards, and puts its zero axis and value columns at different positions. The product ranks by absolute size, uses 44 px rows, one diverging scale and shared columns per card, and grows the cards for up to ten rows plus expansion. Matching the source here would break the required behavior.
- Below 480 px the product hides the percentage card's absolute-change column to keep the plot and signed percentage readable. The source shows that column in its static render.
- The source's fixed attribution and stablecoin note cannot describe the 11-asset fixture. The product computes both notes from stored assets.
- The product calculates the top two share from total absolute movement so mixed gains and losses cannot produce a share outside 0% to 100%. That changes the source's eight-asset `68%` to `67%`.
- The visible mask control remains in the Snapshots card so users can hide values; the static source omits it.
- A 44px Back control remains visible at the upper right so the Analytics subpage has an explicit return route; the static reference omits it. It now starts below the device's top safe area.
- Snapshot value type size, picker borders and day-dot placement, small spacing, and text rasterization remain visibly different. They use the app's shared components and could be matched but are not worth another round.
