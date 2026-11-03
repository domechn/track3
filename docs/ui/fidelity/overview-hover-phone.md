# Overview · chart hover · phone

Reference viewed: authoritative `source/ds/pages/core-overview.html#hover` at 390 × 844, dark; no separate approved JPG was supplied. The structure below the tooltip is the default Overview in [overview-phone.md](overview-phone.md).

## Structure and exact copy

The hero chart is x33 y398, 324×190px. The source hover state selects the stored 15 Oct snapshot. A faint vertical guideline is drawn at x175 from chart y26 to y164 and a blue-outlined 3.5px point marks `$726,928`. The tooltip is x187 y398, 78×46px, with 6px radius, `--raised #1b1a20` fill, `--control #3a3a3e` border, 6px 8px padding, 12px text, and a soft shadow. It shows `15 Oct` in muted text and `$726,928` in white 600 weight on the next line. The series and all other cards retain their default order and values.

Pointer hover or touch drag over the real chart chooses the nearest available stored point; leaving the chart clears the tooltip. The chart retains its accessible image label.

## Original capture and pixel difference

App: `/tmp/fidelity/overview/overview-hover-phone.png`. Source: `/tmp/fidelity/overview/design-overview-hover.png`. Both are 390 × 844 dark viewport captures. Pixel difference: **2.56%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 2.58/255. Source/app heights 844/844px.

## Remaining differences

- Current 390px viewport pixel diff: **3.10%** (any RGB channel differs by more than 20).
- The stored tooltip value, date, guideline, point, and position match. The remaining chart, header icon, and text edges come from mobile-context rendering of the interactive chart.
