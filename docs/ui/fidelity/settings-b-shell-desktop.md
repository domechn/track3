# Settings B desktop shell

Source: `source/ds/ds.css`, `source/ds/ds.js`, `source/ds/pages/settings-shell.js`, `source/ds/pages/settings-b.css`, and the six `settings-b-*.html` pages under `/home/ubuntu/.hermes/projects/track3-design/`. All 52 approved JPEG states were viewed. Measurements below are `getBoundingClientRect()` and `getComputedStyle()` in Chromium at a 1600px viewport, dark colour scheme. The complete per-state measurements and source renders are in `/tmp/fidelity-desktop/settings-b/`.

| Element | Exact source geometry and type |
| --- | --- |
| App rail | x 0–56px, `#0d0d0e`, icon only, 12px 10px padding, 13/18 Public Sans. |
| Main | x 56–1600px, 20px top / 28px horizontal / 40px bottom padding. |
| Header | x 84px, y 20px, width 1488px, height 74px. Breadcrumb `Settings` is 12px. Title y 42px, 26px/32px, weight 600. Subtitle y 76px, 13px/18px, `#b4b6bc`. |
| Settings menu | x 84px, y 110px, width 208px; 16px right padding and 1px `#222224` right border. Group names 12px `#9b9da3`; links 34px high with a 2px gap, 6px radius. Selected link `#1c1c20`, white text and a 2px blue left rule. |
| Content | x 320px, y 110px, width 1252px; 28px menu gap. Twelve-column CSS grid, 16px gaps. Seven-column cards width 723.7px; five-column cards width 512.3px. Full-width cards 1252px. |
| Cards and controls | Cards have 20px padding, 1px `#222224` border, 6px radius, `#131217` background. Card headings 15px/20px weight 600; descriptions 12px/16px `#b4b6bc`; body 13px/18px. Inputs 36px high, 12px horizontal padding, 6px radius, `#0a0a0b` fill and `#3a3a3e` border. Their `.v` value spans are 22px/28px weight 500 even when the `.input.mono` wrapper is 12px. Buttons 34px high, 14px horizontal padding, 999px radius, 13px/18px weight 500. |
| Repeated rows | `.frow` minimum 56px, 12px vertical padding, `#1b1a1f` separator. `.ckrow` has 10px vertical padding and the same separator. Small text is 12px/16px. Numbers use tabular figures. |
| Dialog, toast, popover | Dialogs are centred with a dim full-screen scrim; width 560px or 640px depending on state. Toasts are 24px from the right and bottom. Sync popover is fixed at top 68px, right 28px, width 392px. |
| Colours | Accent blue `#4a8ad6`; positive green `#5fc39c`; negative pink `#ee6a82`; warning amber `#d9a441`. Text white, secondary `#b4b6bc`, faint `#9b9da3`. No gradients or glow. |

The navigation map marks desktop checkout and backup folder selection as desktop features, and app lock as phone only. Group 3 must keep genuine product behaviour when the design illustrates unimplemented desktop controls. References and captures are under `/tmp/fidelity-desktop/`, outside the repository.

At widths of 1500px and above, the date range, Refresh, and source-status controls are hidden on Settings routes; they remain available on portfolio routes and at narrower widths. The Sync status control stays in the top-right corner. The Goals unread dot reflects unread alerts in both the source and the fixture; its size and placement differ slightly.
