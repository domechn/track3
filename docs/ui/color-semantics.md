# Direction colour semantics

## Rules

| Meaning | Colour |
| --- | --- |
| Positive change, gain, rise, improved rank | `--gain`, resolved from the user's quote-colour preference (`--positive` or `--negative`) |
| Negative change, loss, fall, worse rank | `--loss`, resolved from the same preference |
| Zero or unknown change | `--muted-foreground`; no gain or loss swatch |
| Partial result with a known change | The same sign colour as a complete result; partial status is shown separately |
| Neutral series, category, selection, link, or total value | `--accent-data`, chart palette, or muted tokens; blue carries no gain/loss meaning |
| Error, warning, source health, alert severity, or invalid target total | Status colours (`--negative`, `--warning`, etc.) are independent of the quote preference |

`src/utils/color.ts` bridges text classes, logical and physical data tones, CSS/SVG colour variables, Tailwind bar classes, and Chart.js colour strings. React receives the live quote-colour value from the existing app state; CSS/SVG consumers also follow the root `data-quote` attribute updated by that state.

## Audit

“Before” records the colour source found during this audit. “Result” states the rule now used, or why a neutral/status colour stays.

| Component | Meaning | Before | Result |
| --- | --- | --- | --- |
| Desktop/iPad Overview `DailyChangeCard` | Daily gain/loss bars and desktop Up/Down labels | Up bar was forced to `--accent-data` in desktop `style.css`; labels muted | `directionColorVar` bars, `directionClass` labels; zero bar and axis muted; native title tooltip contains signed text without a colour |
| Phone Overview `DailyChart` | Daily gain/loss SVG bars and Up/Down labels | Up used `--fd-accent`; down `--fd-loss`; labels muted | `directionColorVar` for bars and labels; zero muted; zero axis remains muted |
| Retired phone `.fd-overview-bars` CSS | Unused older daily bar style | Default bar was blue `--fd-accent` | Removed the unused style so it cannot restore blue up bars |
| Desktop/legacy Overview `WhatMovedCard` | Asset contribution | Separate `--gain`/`--loss` CSS bars and text | Shared `directionColorVar` bars and `directionClass` text; quote aware |
| Phone/iPad Overview What moved | Asset contribution | `data-tone` with `--fd-gain`/`--fd-loss` | `directionTone` supplies the logical tone to the quote-aware CSS |
| Phone Overview date sheet | Selected range gain/loss | Overrode `--fd-gain`/`--fd-loss` with fixed dark-theme hex | Uses `--gain`/`--loss`, including live quote changes |
| Desktop/phone Overview holdings and top coins | Holding share and 24h/7d change | Share bars use chart palette; signed values used local gain/loss mapping | Share palette stays neutral; desktop signed values use `directionClass` |
| Desktop/phone Overview total value | Total level and period change | Total line blue; change text uses gain/loss | Blue total line stays neutral; signed change stays directional |
| Desktop/phone PNL chart | Positive/negative bar datasets | Duplicated token selection through `positiveNegativeTone` | `directionChartColor`; zero has no negative colour |
| Desktop/phone Profit attribution | Signed market effect leaders and table | Duplicated physical green/red selection | `directionBackgroundClass`/`directionColorVar` bars and `directionClass` text; market/quantity split remains blue/grey |
| Desktop/phone Profit summary | Monthly/yearly PNL and up/down counts | Physical token mapping and `--gain`/`--loss` bars | Existing quote-aware mapping retained; fixed the light summary rule that applied the quote swap twice |
| Desktop Summary profit/loss | PNL, cumulative PNL line, and up/down counts | Physical positive/negative classes; cumulative PNL line was fixed blue and its endpoint label white | Quote-aware classes retained; cumulative line segments split at zero and its endpoint label uses `directionColorVar`; light summary rule now respects physical colours |
| Phone/iPad Summary fidelity | PNL, cumulative PNL line, monthly/yearly bars, movers | `data-tone` and `--fd-gain`/`--fd-loss`; cumulative PNL line was fixed blue | Cumulative line segments split at zero and its endpoint label uses `directionColorVar`; `directionTone` supplies bar and text tones; blue market/quantity attribution marks neutral categories |
| Desktop Summary market card | Signed attribution totals and leaders | Physical positive/negative classes | Quote-aware mapping retained; light summary rule now respects their physical colours |
| Desktop/phone Comparison movers | Signed value and percentage bars | Ad hoc physical green/red selection | `directionBackgroundClass` bars and `directionClass` labels |
| Desktop Comparison fidelity | Signed difference and diverging bars | `positiveNegativeTone` mapped to physical `pos`/`neg` CSS | `directionPhysicalTone` supplies the bar and text classes; blue calendar selection stays neutral |
| Phone/iPad Comparison fidelity | Signed difference and diverging bars | `data-tone` with `--fd-gain`/`--fd-loss` | `directionTone` supplies the bar and text tones; blue selection stays neutral |
| Desktop/phone Wallet source changes | Source deltas | `positiveNegativeTextClass` | Already quote aware |
| Desktop/phone Wallet assets change | Asset percentage and value deltas | Hard-coded emerald/rose utility classes selected per preference | `directionClass` uses theme tokens and follows live preference |
| Desktop Wallets fidelity | Total and source deltas, diverging bars | Physical `pos`/`neg` selected with `positiveNegativeTone` | `directionPhysicalTone` supplies the bar and text classes; source allocation stays neutral |
| Phone/iPad Wallets fidelity | Total and source deltas, diverging bars | `data-tone` and `--fd-gain`/`--fd-loss`, but CSS forced the main and balance deltas gray; zero used gain; selected source header inherited the portfolio delta tone | `directionTone` supplies text and bar tones, mutes zero/unknown, colours the selected header from the displayed source delta, and CSS no longer overrides signed deltas |
| Desktop History list/detail | Snapshot changes and edit-log delta | Snapshot changes used `positiveNegativeColor` (`--gain`/`--loss`); edit-log delta used fixed physical `pos`/`neg` and treated zero as positive | Snapshot changes remain quote aware; `directionPhysicalTone` maps edit-log delta to `pos`/`neg`/`zero`; selected row blue stays neutral |
| Phone/iPad History list/detail | Snapshot changes | Physical tone mapping and matching phone CSS treated zero as loss | `directionPhysicalTone` retains quote-aware physical colours and mutes zero; delete and source health colours remain status colours |
| Desktop/phone Coin detail | 24h/7d/30d, realized and unrealized PNL | Sign classes / `data-tone` with gain/loss tokens | Already quote aware; price/value time-series blue stays neutral |
| iPad Coin detail | 24h price change badge | `DeltaPill` defaulted to green-up, even under red-up | Pass the live quote preference to the badge |
| Desktop/phone Rebalance charts | Signed deviation vs current/target allocation | Ad hoc Chart.js green/red deviation colours; blue allocations | `directionChartColor` deviations; blue allocations stay neutral |
| Desktop/phone Rebalance drift summary | Magnitude outside tolerance | Warning when breached, muted otherwise | Warning remains threshold status; plus/minus sign communicates drift direction |
| Desktop/phone Goals | Portfolio value, threshold, alert severity | Blue total line; warning/error badges | Blue total line stays neutral; badges convey severity, not gain/loss |
| Desktop/phone Cost basis Chart.js and phone asset bars | Realized/unrealized gain/loss, cumulative gains | Hard-coded desktop hex colours and duplicated mobile mapping | `directionChartColor` uses theme tokens; phone asset bars use `directionPhysicalTone` with their existing physical CSS aliases; cost composition palette stays categorical |
| Desktop Cost basis view and panels | Gain/loss KPIs, holding and asset bars, lot totals | Physical `pos`/`neg` selected with quote preference; panels built bar classes from text classes | Shared direction helpers supply bar and text classes; zero/unknown muted |
| Phone/iPad Cost basis view | Gain/loss KPIs, asset bars, lot totals | Physical `data-tone` selected with quote preference | Already quote aware; zero/unknown muted |
| Desktop/phone Top coins percentage change | End-change sparkline, values, rank badges | Fixed `#10b981`/`#f43f5e` and emerald/rose classes | `directionColorVar` sparkline, `directionClass` values; ranking background muted |
| Desktop/phone Top coins rank | Improved/worse rank badges | Fixed emerald/rose classes | `directionClass`; badge surface muted |
| Desktop Appearance quote previews | Illustrative up/down values | Fixed dark-theme green/red hex on both themes | Uses light/dark `--positive` and `--negative` samples for each quote choice |
| Phone/iPad Appearance quote previews | Illustrative up/down values | Dark preview cards with physical green/red samples | Dark samples retained because their preview surface is deliberately dark |
| ATH distance / progress | Signed distance and percentage toward high | Gain/loss text; blue progress | Signed distance stays directional; progress remains neutral |
| CSV/export and share previews | Numeric signed data | No colour fields in persisted output | No colour mapping to change |
| iOS widgets under `src/` | — | No widget implementation found | No mapping to change |

## Contrast

WCAG contrast ratios computed from desktop and iOS tokens. Bar minimum includes 80% opacity against card, page, or raised surfaces. Text minimum includes those surfaces with up to a 15% direction-coloured tint. The same physical tokens swap roles under red-up preference. The light `--positive` token was darkened from 30% to 25% lightness so green text clears 4.5:1 on tinted surfaces.

| Theme | Green text | Red text | Green bar | Red bar |
| --- | ---: | ---: | ---: | ---: |
| Light | 4.73:1 | 4.60:1 | 3.89:1 | 4.28:1 |
| Dark, desktop | 6.18:1 | 4.66:1 | 5.66:1 | 4.10:1 |
| Dark, phone/iPad | 6.08:1 | 4.67:1 | 5.59:1 | 4.14:1 |

Required: text ≥ 4.5:1, bars and swatches ≥ 3:1.
