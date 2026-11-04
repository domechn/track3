# Marketing screenshots

These images are captured from the real React app through the existing Playwright Tauri bridge. The bridge uses the fidelity fixtures' invented $763,809.27 portfolio, eight assets, and five sources. No account or live API is needed.

From the repository root, with Node 24 and Playwright Chromium installed:

```bash
timeout 600 env TRACK3_MARKETING=1 corepack yarn playwright test tests/e2e/marketing-screens.spec.ts --project=desktop --workers=1
timeout 600 node scripts/marketing-screens.mjs
timeout 600 corepack yarn tsc -p tests/e2e/tsconfig.json --noEmit
```

The spec is skipped during normal test runs. It captures at a fixed 31 October 2026 time in English, waits for loaded page content and fonts, redraws the desktop Overview chart at its final viewport size and waits for its canvas to settle, checks the visible text for addresses, emails, keys, and loading copy, then writes unprocessed PNGs to `/tmp/marketing/raw/`. The post processor uses Chromium canvas to export assets and writes `/tmp/marketing/sizes.json` with source and output sizes. It requires all raw captures; a missing page fails the run.

| Output | Dimensions | Use |
| --- | --- | --- |
| `/tmp/marketing/site/desktop/*.webp` | 1600 × 1000 | Copy the eleven files to `images/desktop/` on the website branch later. `overview.webp` is light; `overview-dark.webp` is dark. |
| `images/demo/sc1.jpg` through `sc7.jpg` | 3024 × 2024 | README desktop images, in overview, summary, wallets, cost basis, history, rebalance, goals order. |
| `docs/ios/screens/{overview,history,analytics,assistant,goals,wallets,sources}-{dark,light}.png` | 780 × 1688 | README and iPhone images. |
| `/tmp/marketing/site/ios/{overview,history,analytics,assistant,goals,wallets,sources}-{dark,light}.webp` | 600 × 1298 | Copy to the website branch later after reviewing the rendering limits below. The current light iPhone exports are not ready for the site. |
| `/tmp/marketing/site/ios/pro-landscape-*.webp` | 1100 × 825 | Eight iPad landscape images: overview-light, overview-dark, assistant, assistant-dark, history-detail, history-detail-dark, settings, settings-dark. Unsuffixed names are light. Captured at the 1376 × 1032 iPad viewport and scaled to this size. |
| `/tmp/marketing/site/social-overview.jpg` | 1200 × 630 | Social card with the dark desktop and iPhone overview. |

Review every exported image after regeneration. The test checks data and settled state; visual review catches composition, crop, and layout problems. Keep `/tmp/marketing/` outside git and do not use live portfolio data.

## Current rendering limits

The current light iPhone exports are **not ready for the website**. In `overview-light`, the selected 30D label is dark on black and the bell is a solid black disc. In `wallets-light`, the selected All sources label is white on near-white. In `analytics-light`, the selected All filter has no visible fill. The Data sources page retains a dark surface with the light theme selected, and saved replies disappear against the light Assistant thread background. The light Assistant capture therefore uses its populated welcome and insights state. Fix these app rendering issues and regenerate the images before publishing the light exports.

Other visible limits of the current captures:

- The desktop Overview header's Live total has no value until its popover opens and fetches live prices. The fixture's saved `$763,809.27` is not a live quote, so the header remains empty in the desktop Overview, README overview, and social card.
- Data sources shows a dash for OKX even though Wallets includes its `$142,475.77` last good balance; the source summary therefore reports only two active sources and `$358,418.17`. The fixture's masked key hint ends in `-key`. The desktop Settings capture shows Backup & sync so its options fill the frame.
- The iPad Backup & sync capture shows an unconnected form and cuts off the passphrase help at the bottom. The iPad History detail capture shows placeholder logo blobs. The iPad Assistant at wide widths crowds its chat list text into the header area.
- The desktop Comparison capture ends at the Biggest movers headers, and the iPhone Assistant captures clip the bottom edge of the suggestion chips.

The UI refactor guard requires the owner's `format-exception-approved` label for a PR containing `docs/ios/screens/**`, `images/demo/**`, `README.md`, and this generator. Without that label, the iOS foundation and quality guard jobs fail on denied paths.
