# Settings A desktop shell

Every Settings A JPG was opened and inspected. The authoritative source is `ds/pages/settings-a-*.html`, `settings-a.js`, `settings-a.css`, `settings-shell.js`, `ds.css`, `ds.js`, `lib.js`, `ds/BRIEF.md`, and `core-navigation-map.html`. Measurements below are from Chromium at 1600 × 900, using `getBoundingClientRect()` and `getComputedStyle()`. The supplied JPGs and capture comparisons are 1600px wide.

| Block | Exact geometry and computed style |
| --- | --- |
| Rail | x 0–56, full viewport. Ground `#0d0d0e`; icons, dividers, selected state follow `ds.js`. |
| Main | x 56–1600, padding 20px top, 28px sides, 40px bottom. |
| Heading | x 84, y 20. Crumb `Settings` is 12px/18px `--faint`; title starts y 42 and is Public Sans 26px/32px weight 600; subtitle y 76 is 13px/18px `--muted`. Actions align right. |
| Settings grid | x 84, y 110, width 1488; 208px menu, 28px gap, 1252px page. Menu has 16px right padding and 1px border. Links are 191×34px with 10px side padding and icon gap, 6px radius; selected link uses `#1c1c20` with a 2px `--accent` left marker. Group headings are 12px `--faint`. |
| Main cards | `--surface` `#131217`, 1px `--border` `#222224`, 6px radius, 20px padding unless `pad0`; 16px grid gap. Buttons are 34px high, 13px/18px weight 500 with pill radius. |
| Split grids | `g12` is 1252px wide with 16px gap. `s7` is 724px, `s5` is 512px (currency and appearance); `s8` is 829px and `s4` is 407px (blacklist); language uses equal 618px columns. |
| Source tab strip | x 320, y 110, width 1252, 34px high, 2px gap. A selected tab has a 2px blue bottom rule. Its table starts y 160. |
| Source table | Header height 36px, 12px `--faint`; rows at least 64px with 20px side padding, 16px column gaps. Columns are `minmax(220px,1fr) 110px 120px 140px 64px 172px`. Footer has a top divider and 14px vertical padding. |
| Colours | `--ground` #0d0d0e; `--surface` #131217; `--sunken` #0a0a0b; `--rule` #1b1a1f; `--border` #222224; `--control` #3a3a3e; `--text` #fff; `--muted` #b4b6bc; `--faint` #9b9da3; `--accent` #4a8ad6; `--positive` #5fc39c; `--negative` #ee6a82; `--warning` #d9a441; info fill #14243a. Body type is Public Sans 13px/18px weight 400 and numbers are tabular. |

The menu order is Data: Data sources, Blacklist; Preferences: Currency & display, Appearance, Language; Account: Pro & license, AI assistant; Data & security: Backup & data, Security, Backup & sync; About. The selected route must remain the app's existing hash route and all menu items stay keyboard accessible.

At widths of 1500px and above, the date range, Refresh, and source-status controls are hidden on Settings routes; they remain available on portfolio routes and at narrower widths. The Sync status control stays in the top-right corner. The Goals unread dot reflects unread alerts in both the source and the fixture; its size and placement differ slightly.

Detailed page content, interactions, fixture constraints, pixel ratios, and remaining differences are in the page files next to this one.
