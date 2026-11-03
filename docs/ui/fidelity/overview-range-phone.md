# Overview date range sheet phone design specification

Reference: `phone/core/overview-range-phone.jpg`; source `source/ds/pages/core-overview.html#range`. Background is the same Overview top at 390 × 844, dimmed by a 55% black scrim. Same tokens as [overview-phone.md](overview-phone.md).

The `--surface` bottom sheet is x=0, y=131, width=390, height=713; 16px top corner radius, `--control` top border, 8px top/16px sides/28px bottom padding. The 36 × 4 grabber is at (177,140), followed by `Date range` white 18/24 600 at (16,166) and a 44px close X. It contains:

1. Seven 44px outline pill chips at y=212–308, 8px gaps: `Today`, `7 days`, `30 days`, `90 days`, `1 year`, `All time`, `Custom`. Custom has accent border and `--accent-soft` fill. Chips change presets; Custom reveals the calendar.
2. `From` and `To` faint 12px labels. Two 174 × 44 sunken 6px radius date inputs at (16,346) and (200,346), containing `8 Oct 2026` and `24 Oct 2026`.
3. October 2026 calendar x=16, y=402, width=358, height=280. Header has previous/next chevrons and `October 2026` 13px 600. Weekday headings `Mo Tu We Th Fr Sa Su` are 12px faint, 24px high. Seven equal columns (51.14px), 44px day cells, blue 32px start/end disks on 8 and 24, `--accent-soft` selection band, 31 circled as today. Earlier than first snapshot is disabled.
4. `8 Oct – 24 Oct 2026 · 17 snapshots` then `+$8,929.61 (+1.23%)`, positive green, at y≈692. Full-width 358 × 48 white primary pill `Apply range` at (16,742).
5. Centered 12px faint note: `First snapshot is 1 Oct 2026, so earlier dates are unavailable.` Apply updates the real selected range and closes the sheet; X or scrim closes it without applying.

## Original capture and pixel difference

App: `/tmp/fidelity/overview/overview-range-phone.png`. Source: `/tmp/fidelity/overview/design-overview-range.png`. 390px dark, full page. Pixel difference: **5.12%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 4.77/255. Source/app heights 844/844px. Compared with `/tmp/fidelity/calc-ratios.mjs` using the authoritative Chromium HTML render. This numerical threshold does not waive any visible difference.

## Remaining differences

- Current 390px viewport pixel diff: **4.96%** (any RGB channel differs by more than 20).
- The accessible date sheet keeps typed From/To entry, full-date names for day buttons, and focus management. The static HTML reference has read-only fields and no focus behavior. Their outlines and text rasterize differently in the modal layer; the measured sheet sections and calendar now align.
