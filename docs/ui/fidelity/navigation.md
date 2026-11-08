# Shared navigation fidelity

The authoritative dark source is `source/ds/pages/core-overview.html` with `ds.css` and `ds.js`. Chromium captured it at 1280 × 800, 820 × 844, and 390 × 844. Source files were copied for Chromium's file access; only the local chart script path changed. The 8 Nov product captures are in `/tmp/ui35-final/nav/`. The 390 px and collapsed 820 px source captures are in `/tmp/nav-review/ui35-current/`; the 1280 px and expanded 820 px source captures are in `/home/ubuntu/snap/chromium/common/ui35/`. A pixel differs when any RGB channel differs by more than 20. The navigation ratio uses the left 56 or 216 columns, or the bottom 60 rows on phone. The viewport ratio uses the whole capture.

| Screen, dark Overview | Viewport difference | Navigation difference |
| --- | ---: | ---: |
| Desktop 1280, collapsed | 10.333% | 7.391% |
| Desktop 1280, expanded | 10.529% | 8.167% |
| iPad 820, collapsed | 10.201% | 8.596% |
| iPad 820, expanded | 13.766% | 10.363% |
| Phone 390 | 9.659% | 30.120% |

`getBoundingClientRect()` and `getComputedStyle()` on the source give a collapsed active rail row at `(10, 62)` with a 35 × 36 px box, 6 px radius, `rgb(28, 28, 32)` fill, and a 2 × 20 px edge. The expanded source row is 195 × 36 px. The product's desktop row is `(8, 68)`, 40 × 40 px, 8 px radius, `rgba(72, 136, 213, 0.16)` fill, and a 3 × 20 px edge at x=0. The iPad source has the same 36 px row; the product's painted tile is 40 × 40 px inside a 44 px touch target. Phone source tabs have transparent backgrounds and no edge; the product's selected tab has the shared tint and edge. The route specs verified fixed icon positions and one current link at every route in light and dark mode.

## Remaining differences

- The owner-required shared active state uses 40 px collapsed tiles, 8 px corners, a semantic tint and a 3 × 20 px edge on desktop, iPad and phone. The older design source uses 36 px rail rows, a solid dark fill, a 2 px edge and a text-only selected phone tab. Matching those source pixels would undo the requested consistent navigation state. Coarse-pointer rail rows have 44 px tap targets; their painted tiles remain 40 or 36 px. Their divider margins are 6 px collapsed and 4 px expanded so the visible gap remains 8 px after tile padding.
- The product's two-peak Track3 mark, Settings gear, and working collapse control differ from the source's blue chart mark, Settings sun and static rail. They identify the actual brand and actions.
- The source Overview contains a frozen `$763,809.27` portfolio and its chart, while the product screenshots show the fixture's actual portfolio, live controls and saved data (for example `$75,048.19` on phone). The expanded 820 px source also overflows horizontally; the product keeps controls within its scrollable content. The full-screen ratios include those data and content differences. Product values and routes remain driven by stored assets and snapshots.
- The iPad product uses its mobile Overview card layout and compact header, while the 820 px source keeps the desktop grid. The product's unread badge follows actual alert state, so the source's fixed badge can be absent. Other full-screen differences are listed in [overview-desktop.md](overview-desktop.md) and [overview-phone.md](overview-phone.md).
