# guide-4 desktop design specification

Approved image: `desktop/flows/guide-4-desktop.jpg`. Authoritative source: `source/ds/pages/flows-guide.html#4`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 900 px**. The full-screen guide covers the rail and app shell. The top bar is 60 px high with 28 px horizontal padding. The centered content grid is 1160 px wide: a 420 px text column, an 80 px gap, and a 640 px illustration card. The card has 28 px padding, a 1 px border, a 6 px radius, and a soft 12/28 shadow. Public Sans text uses the app body font; the title is 34/40 px, weight 600, letter-spacing −0.02em. The subtitle is 13/18 px and the body is 15/23 px. Step dots have 8 px diameter and 8 px gaps; the active dot is 22 px wide. Navigation pills are 40 px high with 18 px horizontal padding and a 999 px radius.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.top` | (0, 0) 1600 × 60 px | Track34 of 5Skip |
| `div.mid` | (0, 60) 1600 × 840 px | PlanningPlanning toolsSet target allocations and tolerances in Rebalance. Add rules in Goals & alerts for prices, allocation and p |
| `div` | (220, 246.2) 1160 × 409.6 px | PlanningPlanning toolsSet target allocations and tolerances in Rebalance. Add rules in Goals & alerts for prices, allocation and p |

## Exact visible copy, order, type and colour

The source uses Public Sans with tabular numerals. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. Icons are 18 px stroked SVG by default. Values are USD with comma groups and two decimals, signed changes use + or −, percent values use the precision shown below, dates use abbreviated month names, and source times use 24-hour `HH:MM`.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Track3 | (28, 16) 90 × 28 px | 15px/18px 700 | `rgb(255, 255, 255)` |
| 4 of 5 | (1459, 21) 34 × 18 px | 12px/18px 400 | `rgb(155, 157, 163)` |
| Skip | (1515, 13) 57 × 34 px | 13px/18px 500 | `rgb(180, 182, 188)` |
| Planning | (220, 301) 420 × 18 px | 13px/18px 400 | `rgb(180, 182, 188)` |
| Planning tools | (220, 329) 420 × 40 px | 34px/40px 600 | `rgb(255, 255, 255)` |
| Set target allocations and tolerances in Rebalance. Add rules in Goals & alerts for prices, allocation and profit. | (220, 383) 420 × 46 px | 15px/23px 400 | `rgb(180, 182, 188)` |
| Back | (220, 497) 90 × 40 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Next | (320, 497) 89 × 40 px | 13px/18px 500 | `rgb(13, 13, 14)` |
| Rebalance | (835.6, 512.4) 79 × 19 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Targets | (1012, 512.4) 56 × 19 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Goals & alerts | (1152.4, 512.4) 105 × 19 px | 13px/18px 500 | `rgb(255, 255, 255)` |

## Interactive parts and state variants

This specification covers the **guide-4** state. Segmented controls, pills, source rows, table links, buttons, calendar choices, popovers, dialogs, toasts, dismissals and keyboard focus are actionable only where present in the actual product. The source's visible controls are:

- button: `Skip` at (1515, 13) 57 × 34 px.
- button: `Back` at (220, 497) 90 × 40 px.
- button: `Next` at (320, 497) 89 × 40 px.

The guide has five content variants; the dot and counter identify the current step. Skip/Close dismisses the guide, Back and Next change the step, and the final action opens source setup. Arrow keys change steps, Escape dismisses, and focus remains inside the full-screen dialog. It has no loading, error, popover, or toast state. No persisted data format changes.

## Remaining differences

App capture: `/tmp/fidelity-desktop/guide/guide-4-desktop.png`. Source render: `/tmp/fidelity-desktop/design-flows/guide-4.png`. Pixel diff at the review gate's RGB-difference sum greater than 60: **0.00%** (1600 × 900). The source render and app capture were viewed side by side. No structural, copy, colour, typography, or spacing difference remains at this threshold.
