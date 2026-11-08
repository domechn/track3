# summary-loading phone design specification

References: `phone-long/analyze/summary-loading-phone-long.jpg` and `phone/analyze/summary-loading-phone.jpg`.
Authoritative source: `source/ds/pages/analyze-summary-loading.html`. Measured with getComputedStyle/getBoundingClientRect in headless Chromium, 390 × 844 viewport, device scale 1. Source scroll height: 2597px.

State: Loading: disabled range and Refresh, skeletons preserve final card dimensions.

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
| `.head` | 16, 14, 358, 102 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 10px | Summary Reading snapshots from the local database… 1D 7D 30D 90D 1Y All Refresh |
| `h1` | 16, 14, 358, 28 | 600 22px / 28px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Summary |
| `.sub` | 16, 44, 358, 18 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Reading snapshots from the local database… |
| `.actions` | 16, 72, 358, 44 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 8px | 1D 7D 30D 90D 1Y All Refresh |
| `.card` | 16, 132, 358, 445 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Profit and loss |
| `.card` | 16, 589, 358, 318 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | All-time high since 1 Jul 2025 |
| `.card` | 16, 919, 358, 466 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Profit summary Months of 2026 |
| `.card` | 16, 1397, 358, 380 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | By year 2026 to date |
| `.card` | 16, 1789, 358, 388 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Profit attribution 1 Jul 2025 to 31 Oct 2026, USD |
| `.card` | 16, 2189, 358, 320 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Top profit and loss coins all time |
| `.ch` | 33, 149, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Profit and loss |
| `.ch` | 33, 606, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | All-time high since 1 Jul 2025 |
| `.ch` | 33, 936, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Profit summary Months of 2026 |
| `.ch` | 33, 1414, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | By year 2026 to date |
| `.ch` | 33, 1806, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Profit attribution 1 Jul 2025 to 31 Oct 2026, USD |
| `.ch` | 33, 2206, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Top profit and loss coins all time |
| `.card h2` | 33, 149, 105, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Profit and loss |
| `.card h2` | 33, 606, 94, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | All-time high |
| `.card h2` | 33, 936, 110, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Profit summary |
| `.card h2` | 33, 1414, 53, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | By year |
| `.card h2` | 33, 1806, 120, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Profit attribution |
| `.card h2` | 33, 2206, 176, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Top profit and loss coins |
| `.kpis` | 33, 183, 324, 169 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal |  |
| `.mgrid` | 33, 970, 324, 398 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 10px |  |

## Exact sample copy

Visible text from the rendered source page, top to bottom (including copy inside the source overlay where present):

### 1. head

```text
Summary
Reading snapshots from the local database…
1D
7D
30D
90D
1Y
All
Refresh
```

### 2. card

```text
Profit and loss
```

### 3. card

```text
All-time high
since 1 Jul 2025
```

### 4. card s8 fcol

```text
Profit summary
Months of 2026
```

### 5. card s4 fcol

```text
By year
2026 to date
```

### 6. card s8

```text
Profit attribution
1 Jul 2025 to 31 Oct 2026, USD
```

### 7. card s4

```text
Top profit and loss coins
all time
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

- App capture: `/tmp/fidelity/summary/summary-loading-phone-long.png`.
- Reference render: `/tmp/rev-fa3/design/analyze-summary-loading-long.png`.
- Earlier 390 × 844 first-screen pixel difference: **0.96%** (RGB difference >20/255 in any channel). The 8 Nov 2026 comparison is under Remaining differences.
- Full-page overlap pixel difference: **0.31%** (source 2,597px; app 2,597px high).

## Real-data limits

The phone reads existing SQLite snapshots, transactions, configuration, and wallet data. No persisted column or format was added.

## Remaining differences

- **8 Nov 2026 current 390 × 844 capture:** loading **2.511%** against `ds/pages/analyze-summary-loading.html` (any RGB channel differs by more than 20). Source: `.local/ui46-final/source-390-analyze-summary-loading.html.png`; app: `/tmp/fidelity/summary/summary-loading-phone.png`; source bounds and computed styles: `/tmp/ui46-source-390-analyze-summary-loading.html.json`; app bounds and computed-style assertions: `ios-fidelity-summary-layout.spec.ts`. Remaining visible differences are readable disabled range labels, the live Refresh loading state, Analytics navigation, and Public Sans rasterization.
- The source HTML compresses six disabled range labels into an unreadable cluster. The app keeps each label readable within the segmented control for accessibility.
- The Analytics tab has a small upward chevron to reveal the existing tap-again destinations. The static source has no navigation hint.
