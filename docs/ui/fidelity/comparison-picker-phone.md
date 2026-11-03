# Comparison · snapshot picker · phone

References viewed: `phone/analyze/comparison-picker-phone.jpg` and `source/ds/pages/analyze-comparison-picker.html`. The underlying page is [comparison-phone.md](comparison-phone.md), dimmed by a black scrim. The A picker gets a blue focus border. Source HTML measured at 390 × 844: sheet x0 y368 w390 h476, background `#131217`, 16px top corners, 8px top and 20px bottom padding; calendar x16 y421 w358 h403; 7-column day grid x16 y493 h200. Public Sans body 13/18 and sheet title 15px semibold. Blue is `#4a8ad6`.

## Structure

1. Grab handle centered at top. **Choose snapshot A** heading. Month row with outlined 30px previous and disabled next buttons, `October 2026` centered.
2. Weekday labels Mo Tu We Th Fr Sa Su. Five rows of 7 date cells; Sep 28–30 and Nov 1 are gray unavailable. Oct 1–31 each show a blue dot for an existing snapshot. Oct 1 is blue filled A; Oct 1–31 has a translucent blue range wash; Oct 31 has a blue outlined B.
3. Legend `Has a snapshot` with blue dot; `Grey: none yet`. Selected snapshot row `1 Oct 2026, 09:41` and `$729,167.79`.
4. Bottom buttons side by side: outlined Cancel, white **Use this snapshot**, both 44px pill controls. Tapping an available date updates the selected row; confirmation changes only A, Cancel dismisses; outside tap and Escape should dismiss accessibly.

## Original capture and pixel difference

App: `/tmp/fidelity/comparison/comparison-picker-phone.png`. Source: `/tmp/fidelity/comparison/design-comparison-picker.png`. 390px dark, full page. Pixel difference: **5.40%** of pixels differ by more than 20 in at least one RGB channel; mean maximum-channel difference 6.15/255. Source/app heights 844/844px. Compared with `/tmp/fidelity/calc-ratios.mjs` using the authoritative Chromium HTML render. This numerical threshold does not waive any visible difference.

## Remaining differences

- Current 390px viewport pixel diff: **4.97%** (any RGB channel differs by more than 20).
- The date sheet geometry matches. Its focus-managed modal layer and 44px arrow targets rasterize text and circle outlines differently from the static reference. The mask control remains visible behind the sheet to preserve the existing hide-values action; only real stored snapshots can be selected.
