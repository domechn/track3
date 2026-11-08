# summary-empty phone design specification

References: `phone-long/analyze/summary-empty-phone-long.jpg` and `phone/analyze/summary-empty-phone.jpg`.
Authoritative source: `source/ds/pages/analyze-summary-empty.html`. Measured with getComputedStyle/getBoundingClientRect in headless Chromium, 390 × 844 viewport, device scale 1. Source scroll height: 2237px.

State: One snapshot: disabled range, P&L unavailable, dashed explanations instead of charts/cards. Refresh now is actionable.

## Tokens and global geometry

Public Sans, tabular numerals. Body 13px/18px regular. Main padding 14px top, 16px sides, 24px bottom. Card surface `--surface`, 1px `--border`, 6px radius, 16px padding, 12px vertical gap, 15px/20px semibold heading. Fixed bottom rail: 60px with Overview, History, Analytics, More icon labels and red count 2 on More.

| Token | Hex |
| --- | --- |
| `--ground` | `#0d0d0e` |
| `--surface` | `#131217` |
| `--raised` | `#1b1a20` |
| `--sunken` | `#0a0a0b` |
| `--border` | `#222224` |
| `--rule` | `#1b1a1f` |
| `--control` | `#3a3a3e` |
| `--text` | `#ffffff` |
| `--muted` | `#b4b6bc` |
| `--faint` | `#9b9da3` |
| `--accent` | `#4a8ad6` |
| `--positive` | `#5fc39c` |
| `--negative` | `#ee6a82` |
| `--warning` | `#d9a441` |

## Ordered structure and exact visible copy

| Element | x, y, width, height in px | Style | Copy / component |
| --- | --- | --- | --- |
| `.head` | 16, 14, 358, 120 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 10px | Summary Is the portfolio earning, or only growing? One snapshot so far, so there is nothin |
| `h1` | 16, 14, 358, 28 | 600 22px / 28px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Summary |
| `.sub` | 16, 44, 358, 36 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Is the portfolio earning, or only growing? One snapshot so far, so there is nothing to com |
| `.actions` | 16, 90, 358, 44 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 8px | 1D 7D 30D 90D 1Y All |
| `.card` | 16, 150, 358, 475 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Profit and loss Net P&L (all time) – Needs a second snapshot P&L % – on invested capital B |
| `.card` | 16, 637, 358, 372 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | All-time high from 1 snapshot Highest value so far $763,809.27 31 Oct 2026, your only snap |
| `.card` | 16, 1021, 358, 218 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Profit summary Months of 2026 Month cards appear after the second snapshot. |
| `.card` | 16, 1251, 358, 218 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | By year 2026 to date The year view appears after the second snapshot. |
| `.card` | 16, 1481, 358, 328 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Profit attribution 1 Jul 2025 to 31 Oct 2026, USD Attribution needs two snapshots to split |
| `.card` | 16, 1821, 358, 328 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Top profit and loss coins all time Top profit and loss coins appear after the second snaps |
| `.ch` | 33, 167, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Profit and loss |
| `.ch` | 33, 654, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | All-time high from 1 snapshot |
| `.ch` | 33, 1038, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Profit summary Months of 2026 |
| `.ch` | 33, 1268, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | By year 2026 to date |
| `.ch` | 33, 1498, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Profit attribution 1 Jul 2025 to 31 Oct 2026, USD |
| `.ch` | 33, 1838, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Top profit and loss coins all time |
| `.card h2` | 33, 167, 105, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Profit and loss |
| `.card h2` | 33, 654, 94, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | All-time high |
| `.card h2` | 33, 1038, 110, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Profit summary |
| `.card h2` | 33, 1268, 53, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | By year |
| `.card h2` | 33, 1498, 120, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Profit attribution |
| `.card h2` | 33, 1838, 176, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Top profit and loss coins |
| `.kpis` | 33, 201, 324, 199 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Net P&L (all time) – Needs a second snapshot P&L % – on invested capital Breakeven – value |
| `.empty` | 33, 418, 324, 190 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 24px; gap 10px | The P&L line starts once you have a second snapshot. Refresh now |
| `.empty` | 33, 1072, 324, 150 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 24px; gap 10px | Month cards appear after the second snapshot. |
| `.empty` | 33, 1302, 324, 150 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 24px; gap 10px | The year view appears after the second snapshot. |
| `.empty` | 33, 1532, 324, 260 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 24px; gap 10px | Attribution needs two snapshots to split market moves from deposits. |
| `.empty` | 33, 1872, 324, 260 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 24px; gap 10px | Top profit and loss coins appear after the second snapshot. |

## Exact sample copy

Visible text from the rendered source page, top to bottom (including copy inside the source overlay where present):

### 1. head

```text
Summary
Is the portfolio earning, or only growing? One snapshot so far, so there is nothing to compare yet.
1D
7D
30D
90D
1Y
All
```

### 2. card

```text
Profit and loss
Net P&L (all time)
–
Needs a second snapshot
P&L %
–
on invested capital
Breakeven
–
value where P&L is $0
Positions
8
in 1 snapshot

The P&L line starts once you have a second snapshot.

Refresh now
```

### 3. card

```text
All-time high
from 1 snapshot
Highest value so far
$763,809.27
31 Oct 2026, your only snapshot
You are at the high, so the distance is $0.
First snapshot
31 Oct 2026, 09:41
Assets
8
Sources
5
Current value
$763,809.27
```

### 4. card s8 fcol

```text
Profit summary
Months of 2026

Month cards appear after the second snapshot.
```

### 5. card s4 fcol

```text
By year
2026 to date

The year view appears after the second snapshot.
```

### 6. card s8

```text
Profit attribution
1 Jul 2025 to 31 Oct 2026, USD

Attribution needs two snapshots to split market moves from deposits.
```

### 7. card s4

```text
Top profit and loss coins
all time

Top profit and loss coins appear after the second snapshot.
```

## Controls, states, and formats

- Range segmented control: 1D, 7D, 30D, 90D, 1Y, All; All selected in full state, disabled/dimmed in empty and loading. Refresh is a 44px circle in full/empty and a 34px bordered pill in loading.
- P&L uses signed USD with 2 decimals and signed percentages with 2 decimals; month and year amounts have 0 decimals. Dates use `1 Jul 2025`, abbreviated month/year for cards and chart ticks. Unknown P&L is an en dash.
- Summary card order: Profit and loss, All-time high, Profit summary, By year, Profit attribution, Top profit and loss coins. Empty state keeps all six sections, using dashed explanation boxes. Loading state keeps all six sections, using bars and block skeletons.
- Month cards are a two-column list on phone; each has period, signed P&L, percentage, center-zero micro bar and up/down counts. Year cards use the same data format plus Deposits and number of months.
- The chart shows monthly cumulative net P&L with blue line, left Y axis, three X labels, endpoint dollar annotation, and a best-month vertical marker. ATH has blue progress bar and fact rows.
- Existing sparse-month and unknown-profit behavior takes precedence over invented design data: periods with no snapshot and incomplete cost prices stay explicitly unknown.

## Companion image states

Summary: full, one-snapshot empty and loading. Coin: BTC value and price, BTC transaction detail and edit sheets, NVDA, NOVA and NOVA edit sheet. No separate error image was supplied; retain existing error handling.

## Captured comparison

- App capture: `/tmp/fidelity/summary/summary-empty-phone-long.png`.
- Reference render: `/tmp/rev-fa3/design/analyze-summary-empty-long.png`.
- Earlier 390 × 844 first-screen pixel difference: **2.45%** (RGB difference >20/255 in any channel). The 8 Nov 2026 comparison is under Remaining differences.
- Full-page overlap pixel difference: **0.97%** (source 2,237px; app 2,237px high).
- Premerge master 8 Nov 2026 comparison at 390 × 844: **6.299%** of first-screen pixels differ (RGB difference >20/255 in any channel). Source: `/tmp/fidelity/summary/ui44-source-empty-phone.png`; app: `/tmp/fidelity/summary/summary-empty-phone.png`.

## Real-data limits

The phone reads existing SQLite snapshots, transactions, configuration, and wallet data. No persisted column or format was added.

## Remaining differences

- **8 Nov 2026 branch 390 × 844 capture before this merge:** one snapshot **6.240%** against `ds/pages/analyze-summary-empty.html` (any RGB channel differs by more than 20). Source: `.local/ui46-final/source-390-analyze-summary-empty.html.png`; app: `/tmp/fidelity/summary/summary-empty-phone.png`; source bounds and computed styles: `/tmp/ui46-source-390-analyze-summary-empty.html.json`; app bounds and computed-style assertions: `ios-fidelity-summary-layout.spec.ts`. Both first cards are x=16, y=150, 358 × 475. The source packs disabled range labels into an overlapping strip; the app keeps all six labels readable and the Refresh action reachable. The Analytics menu chevron and unread badge belong to the working product navigation. The source and app rasterize the same Public Sans font differently.
- An empty chart panel now uses the shared centred icon, title, and refresh hint with a 200px minimum. The source predates the shared empty state.

- The source empty state labels attribution with a start date of 1 Jul 2025, although its only snapshot is 31 Oct 2026. The app reports the stored snapshot date.
- The source HTML compresses six disabled range labels into an unreadable cluster. The app keeps each label readable within the segmented control for accessibility.
- The current first viewport has a 6.299% raw pixel difference. The remaining text edges differ because the static source loads Public Sans through Google's stylesheet and Track3 uses its bundled offline face; the card content and order are the same. The source's unreadable range cluster also accounts for visible pixels.
- The Analytics tab has a small upward chevron to reveal the existing tap-again destinations. The static source has no navigation hint.
