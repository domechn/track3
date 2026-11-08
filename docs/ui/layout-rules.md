# Page layout rules

## R2b: No blank slabs

After scrolling to the bottom of any page, there is no empty rectangle at least 120 × 120 px bounded by cards on at least two sides. When adjacent columns have different content heights, align the cards and fill their content, or keep each pane in the app viewport with its own scroll area.

History uses a fixed-height master-detail row with independently scrolling list and detail panes. Coin detail aligns its chart and holdings cards at both edges and lets the chart plot grow with real content.

## Review sweep

The History review compared head and base at 1280 × 720 and 1440 × 900, with the page scrolled to the top, middle, and bottom. It checked Summary, Wallets, Comparison, Cost basis, Goals, Rebalance, BTC detail, History, and Settings Sources, Data, Sync, and Appearance. No page had a new bottom blank slab of at least 120 × 120 px.

At the time of that review, BTC detail had a 538 × 339 px mid-scroll gap below its sticky side column on both head and base. The later Coin detail layout replaced that sticky column with aligned cards. At 1440 × 900, the sticky Settings navigation left 208 × 250 px of space below the rail; this space is outside the card content.

Global audit follow-up: the History Playwright helper checks pane alignment, but does not scan for empty 120 × 120 px rectangles within or between cards. Audit those interior gaps at the top, middle, and bottom of each page across viewport sizes.

## Coin detail

- At widths where the chart and holdings sit side by side, their cards start at the same top edge and end at the same bottom edge, within 1 px. The heading and toolbar sit above the shared row.
- The chart occupies the left column. The right card contains Holdings by source and Open lots, following the desktop design reference. Transactions follow in a full width card.
- Card height follows real content. The chart plot may grow with a long source or lot table. Keep its axis, line, and range statistics visible. Do not stretch an empty card to fill a column.
- Measure the last visible lot row, Show all button, or empty state against the right card's content bottom, and chart stats against the left. Each gap stays below 24 px. The manual price card also keeps its last row within 24 px of Set current price. No page background rectangle of at least 120 × 120 px may sit between cards, bounded by cards or the content edge on two sides.
- Below the two column breakpoint, read in order: chart, holdings and lots, transactions. The same blank area rule applies.
- The 820 px iPad metric grid uses a row of three and a row of two equal width cards. Neither row leaves an unused grid track.
- Check sparse, dense, empty, stablecoin, and stock holdings in both themes. Include 1100, 1280, 1440, 1920, 820, and 390 px viewports.
