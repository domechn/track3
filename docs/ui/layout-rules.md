# Layout rules

## R2b: No blank slabs

After scrolling to the bottom of any page, there is no empty rectangle at least 120 × 120 px bounded by cards on at least two sides. When adjacent columns have different content heights, keep each pane in the app viewport with its own scroll area or keep the shorter column visible with sticky positioning.

## Review sweep

The review compared head and base at 1280 × 720 and 1440 × 900, with the page scrolled to the top, middle, and bottom. It checked Summary, Wallets, Comparison, Cost basis, Goals, Rebalance, BTC detail, History, and Settings Sources, Data, Sync, and Appearance. No page had a new bottom blank slab of at least 120 × 120 px.

BTC detail had a 538 × 339 px mid-scroll gap below its sticky side column on both head and base. At 1440 × 900, the sticky Settings navigation left 208 × 250 px of space below the rail; this space is outside the card content.

Global audit follow-up: the History Playwright helper checks pane alignment, but does not scan for empty 120 × 120 px rectangles within or between cards. Audit those interior gaps at the top, middle, and bottom of each page across viewport sizes.
