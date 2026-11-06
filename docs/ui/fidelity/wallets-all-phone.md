# Wallets · all sources · phone

References: `phone/analyze/wallets-all-phone.jpg`, `phone-long/analyze/wallets-all-phone-long.jpg`, `source/ds/pages/analyze-wallets.html`, `analyze-wallets.js`, `analyze-data.js`, `lib.js`. Viewed at 390px. Source HTML measured in Chromium at 390 × 844. Tokens are in `source/ds/ds.css`: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, rule `#1b1a1f`, border `#222224`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, blue `#4a8ad6`, gain `#5fc39c`, loss `#ee6a82`, warning `#d9a441`. Public Sans body 13/18, page title 22/28 semibold, card title 15/20 semibold, big value 32/36 semibold, 12px supporting copy, 6px card radius, 16px card padding, 12px card gap.

## Structure

1. Page heading x16 y14: **Wallets**. Subtitle y44, three lines: `Which source holds what, and what moved it? Binance holds 46.9% and added +$18,487 of the +$34,641 30-day change.` Bold the Binance fact. Range pills `1D 7D 30D 90D 1Y All`, 30D selected, with circular refresh button at right, y108 h44.
2. Source filter chips x16 y168 h136, three wrapped rows: **All sources**, Binance, warning-dot OKX, Ledger cold wallet, `0x4f...a91c`, Interactive Brokers. 44px pill height, 8px gaps, selected is white with dark text. Tap filters the rest of the page.
3. Allocation by source card x16 y320 w358 h397: title and `share of total value`; total `$763,809.27`; `+$34,641.48 · +4.75% vs 1 Oct`. Three columns: Sources **5**, `2 exchanges · 2 wallets · 1 broker`; Largest source **46.9%**, Binance; Last refresh **09:41**, `4 of 5 sources current`. Thin stacked share bar in blue, light blue, light gray, gray, charcoal. Legend in value order: Binance 46.9%, OKX 18.7%, Ledger cold wallet 16.9%, 0x4f...a91c 8.9%, Interactive Brokers 8.6%.
4. Balances by source x16 y729 h382: five 52px compact grid rows, value right and kind/share plus 30D signed change below. Order/value/change: Binance `$358,418.17`, `+$18,487 · +5.44%`; OKX `$142,475.77`, `+$2,046 · +1.46%`; Ledger `$129,127.05`, `+$8,812 · +7.32%`; 0x4f...a91c `$68,232.78`, `+$4,322 · +6.76%`; Interactive Brokers `$65,555.50`, `−$975 · −1.51%`. Header says `change vs 1 Oct`.
5. Source status x16 y1123 h413: today. Binance green dot `API key, read-only` 09:41; OKX red dot and Failed pill, `Rate limit exceeded (HTTP 429). Showing the last good balances from 09:12.`, outlined Retry and `Next automatic try 10:11`; Ledger green Public address 09:40; 0x4f...a91c green Public address 09:40; Interactive Brokers green Flex Query 09:41.
6. Asset changes per source x16 y1548 h572: `30D, vs 1 Oct, USD`. Ordered BTC `+$14,040.03` (Binance +$5,228; Ledger +$8,812), USDT `−$18.24` (Binance −$11; OKX −$7), ETH `+$9,580.92` (Binance +$3,202; OKX +$2,057; 0x4f...a91c +$4,322), SOL `+$7,449.70`, BNB `+$2,618.47`, USDC `−$4.00`, AAPL `−$231.00`, NVDA `+$1,205.60`. Each is a two-line list row with thin rule.
7. What moved x16 y2132 h453: `30D, all sources`, signed horizontal diverging bars sorted BTC, ETH, SOL, BNB, NVDA, USDC, USDT, AAPL. 40px rows. Bottom bar is fixed at viewport bottom; full page source height 2673px.

## Interactive and data rules

Chips select a source, range changes the compared snapshots, refresh uses the real refresh flow, OKX Retry uses the failed-source retry flow, and the tab bar keeps route navigation. The failure and next automatic try appear only if the actual stored source status and retry scheduler report them. Snapshot values, source names, asset changes, and source grouping must come from existing asset and status shapes. If no comparable snapshot exists, change is unknown; do not imply a price-only change. Preserve value masking and quote color.

## Original capture and pixel difference

App: `/tmp/fidelity/wallets/wallets-all-phone.png`. Source: `/tmp/fidelity/wallets/design-wallets.png`. 390px dark, full page. Pixel difference: **5.90%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 7.27/255. Source/app heights 844/844px. Compared with `/tmp/fidelity/calc-ratios.mjs` using the authoritative Chromium HTML render. This numerical threshold does not waive any visible difference.

Long capture: `/tmp/fidelity/wallets/wallets-all-phone-long.png` vs `/tmp/fidelity/wallets/design-wallets-all-long.png`; **9.10%** pixel difference by the same threshold, heights 2673/2678px.

## Remaining differences

With no sources, Wallets now uses the shared centred empty state and the existing add-source route. The supplied Wallets source pages all contain saved sources, so there is no zero-source reference screen.

- Fresh 5 Nov 2026 390px viewport pixel diff: **6.06%** (any RGB channel differs by more than 20). The full-page diff is **7.15%** over the common 2673 px (source 2673 px; app 2725 px). These are direct source HTML and current app captures in `/tmp/ui3-remeasure/` and `/tmp/fidelity/wallets/`.
- Viewport: the main card geometry and values match. The source was rasterized by desktop Chromium with coloured LCD text edges, while the phone WebView capture uses grayscale text edges. The same local Public Sans font file is loaded and the heading and card bounds agree; CSS font substitution did not change the diff. The product cannot reproduce desktop LCD antialiasing on an iPhone.
- A 44px Back control is visible at the upper right so the Analytics subpage has an explicit return route; the static reference has no Back control. It now starts below the device's top safe area.
- Full page: source status cannot assert that a configured API key is read-only, so it says “Exchange” instead. Stored quantities changed between snapshots, so the app omits the reference’s price-only footnote. The app keeps its Detailed analysis action reachable below the cards; that action accounts for the extra 52 px. The 16-source fixture has no matching source page; its names, card containment and horizontal matrix scroll are verified separately.
