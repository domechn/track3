# Page layout rules

## Coin detail

- At widths where the chart and holdings sit side by side, their cards start at the same top edge and end at the same bottom edge, within 1 px. The heading and toolbar sit above the shared row.
- The chart occupies the left column. The right card contains Holdings by source and Open lots, following the desktop design reference. Transactions follow in a full width card.
- Card height follows real content. The chart plot may grow with a long source or lot table. Keep its axis, line, and range statistics visible. Do not stretch an empty card to fill a column.
- Measure the last visible lot row, Show all button, or empty state against the right card's content bottom, and chart stats against the left. Each gap stays below 24 px. The manual price card also keeps its last row within 24 px of Set current price. No page background rectangle of at least 120 × 120 px may sit between cards, bounded by cards or the content edge on two sides.
- Below the two column breakpoint, read in order: chart, holdings and lots, transactions. The same blank area rule applies.
- The 820 px iPad metric grid uses a row of three and a row of two equal width cards. Neither row leaves an unused grid track.
- Check sparse, dense, empty, stablecoin, and stock holdings in both themes. Include 1100, 1280, 1440, 1920, 820, and 390 px viewports.
