# Layout rules

Apply these checks to loaded content in the desktop and iOS shells at supported widths and in both themes. Measure rendered rectangles; allow only the tolerances below.

- **R1 Row alignment:** Cards beside each other in one row share top and bottom edges within 1 px.
- **R2 Column balance:** Side by side columns end at the same bottom edge within 1 px. Stack columns when their content cannot balance.
- **R3 No blank slabs:** No empty page background rectangle at least 120 × 120 px inside the content area with cards on at least two sides.
- **R4 Card fill:** Empty space from the last rendered row to a card's bottom is less than 24 px, or less than 40 px when a pager follows. Rows spread more than 40 px apart inside a column card and content clipped past a card's bottom also fail. A row's own padding counts when visible content reaches its bottom; an empty stretched wrapper does not count. Content in a vertically scrollable region remains reachable.
- **R5 Grid snap:** Card edges follow the page's 12 column grid with 16 px gutters. Each left or right edge equals a content edge or another card edge within 0.5 px.
- **R6 Bounded collections:** Every list or grid driven by an unbounded array uses a pager or a documented visible cap.
- **R7 Number fit:** Large numbers stay within their cell and never cross a divider, wrap, or sit partly cut at a scroll edge. A horizontal table must fit the pane at rest.
- **R8 Stable chrome:** Sidebar, navigation and toolbar dimensions stay stable between routes with the same chrome variant (desktop rail; phone root, overview overlay, or collapsed bar; phone wallet/comparison compact back, records, settings, or regular pushed bar).
- **R9 Theme tokens:** The existing raw colour guard applies to every themed surface.

An exemption needs `data-layout-exempt="R<n>: <design reason>"` on the affected element and a matching reason below. Empty states still need useful copy or an action.

- Assistant R5: its design fixes the chats and context panes around a flexible thread. Empty chats R4: scroll space keeps the footer at the pane bottom.
- History R5 at 1100–1179 px: eleven tracks keep its independent list and detail panes side by side. Sparse detail R4: the fixed pane reserves a scroll area.
- Coin R4: a bordered chart area remains visible with fewer than three price points.

The audit captures every visited route at dense 1280 px desktop and 390 px phone sizes, plus full route captures at 1100 px, 1440 px, and 820 px. It measures both top and bottom scroll positions. For the dark real-scale routes it records design-page card rectangles and computed backgrounds, and counts viewport pixels whose summed absolute RGB difference exceeds 60. The main phone `diffRatios` compare the approved JPEGs; `desktopHtmlAtPhoneDiffRatios` are separate responsive HTML diagnostics. `tests/e2e/layout-audit.ts` needs the existing owner exception to pass the UI guard on a committed copy; CI requires domechn's `format-exception-approved` label.
