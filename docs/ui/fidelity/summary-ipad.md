# Summary iPad fidelity

The iPad uses Track3's Analytics sidebar and Summary presentation. The supplied `ds/pages/analyze-summary.html` renders a desktop grid at 834 px; its month cards are about 77 × 202 px with clipped copy, and the render overflows to 841 px wide. Track3 keeps month amounts readable in a compact five-column row, with cards about 101 × 70 px. A 12-year range pages four recent years at a time, with the pager after the cards.

## Remaining differences

The shared iPad rail's measured source differences, including its owner-required touch targets and selected tile, are recorded in [navigation.md](navigation.md).

- Fresh 7 Nov 2026 Chromium renders at 834 × 1024 differ by **15.011%** in the first viewport (maximum RGB channel difference over 20). Source: `/tmp/ui24-current/source-834.png`; app: `/tmp/ui24-current/app-834.png`. The distinct iPad Analytics shell and the source's overflowing desktop grid prevent a like-for-like page comparison. The source's month card is about 77 × 202 px with clipped values; the app uses a readable 101 × 70 px five-column card. The app's four-year pager also has no counterpart in the two-year source sample.
- The iPad month-card height floor is **68 px** in the UI24 layout test, with observed cards at 70 px. The design's 140–200 px floor applies to phone and normal desktop cards; using it for the iPad's five-column row would add empty space or clip the card content.
