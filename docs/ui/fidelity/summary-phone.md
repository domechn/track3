# summary phone design specification

References: `phone-long/analyze/summary-phone-long.jpg` and `phone/analyze/summary-phone.jpg`.
Authoritative source: `source/ds/pages/analyze-summary.html`. Measured with getComputedStyle/getBoundingClientRect in headless Chromium, 390 × 844 viewport, device scale 1. Source scroll height: 3633px.

State: Full portfolio: P&L chart, ATH, month/year cards, attribution, ranked coins.

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
| `.head` | 16, 14, 358, 138 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 10px | Summary Is the portfolio earning or just growing? +$188,809 of the $453,809 gain since Jul |
| `h1` | 16, 14, 358, 28 | 600 22px / 28px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Summary |
| `.sub` | 16, 44, 358, 54 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Is the portfolio earning or just growing? +$188,809 of the $453,809 gain since Jul 2025 is |
| `.sub` | 33, 436, 324, 18 | ; rgb(155, 157, 163); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Cumulative net P&L at each month end, since 1 Jul 2025 |
| `.actions` | 16, 108, 358, 44 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 8px | 1D 7D 30D 90D 1Y All |
| `.card` | 16, 168, 358, 499 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Profit and loss Net P&L (all time) +$188,809.27 since 1 Jul 2025 P&L % +32.84% on $575,000 |
| `.card` | 16, 679, 358, 409 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | All-time high since 1 Jul 2025 Highest value recorded $801,240.50 19 Mar 2026 · 226 days a |
| `.card` | 16, 1100, 358, 916 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Profit summary Months of 2026 Jan 2026 +$31,700 +5.08% 5 up · 1 down Feb 2026 −$42,600 −6. |
| `.card` | 16, 2028, 358, 446 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | By year 2026 to date 2026 Jan–Oct +$60,109 +8.54% Deposits +$105,000 4 up · 2 down 10 mont |
| `.card` | 16, 2486, 358, 473 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Profit attribution 1 Jul 2025 to 31 Oct 2026, USD Market move Quantity change (deposits, b |
| `.card` | 16, 2971, 358, 574 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Top profit and loss coins all time Top profit BTC +$104,329 +102.9% ETH +$69,400 +84.8% BN |
| `.ch` | 33, 185, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Profit and loss |
| `.ch` | 33, 696, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | All-time high since 1 Jul 2025 |
| `.ch` | 33, 1117, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Profit summary Months of 2026 |
| `.ch` | 33, 2045, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | By year 2026 to date |
| `.ch` | 33, 2503, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Profit attribution 1 Jul 2025 to 31 Oct 2026, USD |
| `.ch` | 33, 2988, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Top profit and loss coins all time |
| `.card h2` | 33, 185, 105, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Profit and loss |
| `.card h2` | 33, 696, 94, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | All-time high |
| `.card h2` | 33, 1117, 110, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Profit summary |
| `.card h2` | 33, 2045, 53, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | By year |
| `.card h2` | 33, 2503, 120, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Profit attribution |
| `.card h2` | 33, 2988, 176, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Top profit and loss coins |
| `.kpis` | 33, 219, 324, 199 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Net P&L (all time) +$188,809.27 since 1 Jul 2025 P&L % +32.84% on $575,000 Breakeven $575, |
| `.mgrid` | 33, 1151, 324, 780 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 10px | Jan 2026 +$31,700 +5.08% 5 up · 1 down Feb 2026 −$42,600 −6.50% 0 up · 6 down Mar 2026 +$1 |
| `.mc` | 33, 1151, 157, 148 | ; rgb(255, 255, 255); bg rgb(13, 13, 14); padding 14px 14px 12px; gap 2px | Jan 2026 +$31,700 +5.08% 5 up · 1 down |
| `.mc` | 200, 1151, 157, 148 | ; rgb(255, 255, 255); bg rgb(13, 13, 14); padding 14px 14px 12px; gap 2px | Feb 2026 −$42,600 −6.50% 0 up · 6 down |
| `.mc` | 33, 1309, 157, 148 | ; rgb(255, 255, 255); bg rgb(13, 13, 14); padding 14px 14px 12px; gap 2px | Mar 2026 +$101,300 +15.76% 6 up · 0 down |
| `.mc` | 200, 1309, 157, 148 | ; rgb(255, 255, 255); bg rgb(13, 13, 14); padding 14px 14px 12px; gap 2px | Apr 2026 −$41,600 −5.59% 2 up · 4 down |
| `.mc` | 33, 1467, 157, 148 | ; rgb(255, 255, 255); bg rgb(13, 13, 14); padding 14px 14px 12px; gap 2px | May 2026 +$9,400 +1.30% 4 up · 2 down |
| `.mc` | 200, 1467, 157, 148 | ; rgb(255, 255, 255); bg rgb(13, 13, 14); padding 14px 14px 12px; gap 2px | Jun 2026 −$35,600 −4.80% 2 up · 4 down |
| `.mc` | 33, 1625, 157, 148 | ; rgb(255, 255, 255); bg rgb(13, 13, 14); padding 14px 14px 12px; gap 2px | Jul 2026 +$38,300 +5.42% 5 up · 1 down |
| `.mc` | 200, 1625, 157, 148 | ; rgb(255, 255, 255); bg rgb(13, 13, 14); padding 14px 14px 12px; gap 2px | Aug 2026 −$15,800 −2.07% 3 up · 3 down |
| `.yc` | 33, 2079, 324, 183 | ; rgb(255, 255, 255); bg rgba(74, 138, 214, 0.14); padding 14px; gap 2px | 2026 Jan–Oct +$60,109 +8.54% Deposits +$105,000 4 up · 2 down 10 months |
| `.yc` | 33, 2274, 324, 183 | ; rgb(255, 255, 255); bg rgb(13, 13, 14); padding 14px; gap 2px | 2025 Jul–Dec +$128,700 +27.38% Deposits +$160,000 5 up · 1 down 6 months |

## Exact sample copy

Visible text from the rendered source page, top to bottom (including copy inside the source overlay where present):

### 1. head

```text
Summary
Is the portfolio earning or just growing? +$188,809 of the $453,809 gain since Jul 2025 is market P&L; $265,000 is money you added.
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
+$188,809.27
since 1 Jul 2025
P&L %
+32.84%
on $575,000
Breakeven
$575,000
P&L is $0
Positions
8
4 up · 2 down
2 flat
Cumulative net P&L at each month end, since 1 Jul 2025
0
100K
200K
300K
1 Jul 25
Feb 26
Oct 26
$188,809
Best month
```

### 3. card

```text
All-time high
since 1 Jul 2025
Highest value recorded
$801,240.50
19 Mar 2026 · 226 days ago
Now 95.3% of ATH
ATH
Distance from ATH
−$37,431.23 · −4.67%
Gain needed to reach it
+4.90%
Previous high
$668,200.00 · 27 Jan 2026
Lowest since ATH
$681,300.00 · 22 Apr 2026
Current value
$763,809.27
```

### 4. card s8 fcol

```text
Profit summary
Months of 2026
Jan
2026
+$31,700
+5.08%
5 up · 1 down
Feb
2026
−$42,600
−6.50%
0 up · 6 down
Mar
2026
+$101,300
+15.76%
6 up · 0 down
Apr
2026
−$41,600
−5.59%
2 up · 4 down
May
2026
+$9,400
+1.30%
4 up · 2 down
Jun
2026
−$35,600
−4.80%
2 up · 4 down
Jul
2026
+$38,300
+5.42%
5 up · 1 down
Aug
2026
−$15,800
−2.07%
3 up · 3 down
Sep
2026
−$19,632
−2.62%
2 up · 4 down
Oct
to 31 Oct
+$34,641
+4.75%
5 up · 1 down
P&L % is P&L divided by opening value plus deposits in the period. Up and down count BTC, ETH, SOL, BNB, NVDA and AAPL; stablecoins are left out.
```

### 5. card s4 fcol

```text
By year
2026 to date
2026
Jan–Oct
+$60,109
+8.54%
Deposits
+$105,000
4 up · 2 down
10 months
2025
Jul–Dec
+$128,700
+27.38%
Deposits
+$160,000
5 up · 1 down
6 months
```

### 6. card s8

```text
Profit attribution
1 Jul 2025 to 31 Oct 2026, USD
Market move
Quantity change (deposits, buys)
BTC
USDT
ETH
USDC
BNB
NVDA
SOL
AAPL
$0
$50k
$100k
$150k
Total
$310,000 → $763,809
```

### 7. card s4

```text
Top profit and loss coins
all time
Top profit
BTC
+$104,329
+102.9%
ETH
+$69,400
+84.8%
BNB
+$17,650
+54.9%
NVDA
+$9,850
+46.4%
Top loss
SOL
−$9,300
−11.9%
AAPL
−$3,120
−8.3%
No market P&L
USDT
$0
0.0%
USDC
$0
0.0%
Market P&L per coin since 1 Jul 2025; % is on start value plus quantity added. Stablecoins are held at $1.
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

- App capture: `/tmp/fidelity/summary/summary-phone-long.png`.
- Reference render: `/tmp/rev-fa3/design/analyze-summary-long.png`.
- Earlier 390 × 844 first-screen pixel difference before the additive P&L change: **1.09%** (RGB difference >20/255 in any channel). The 8 Nov 2026 comparison is under Remaining differences.
- Full-page overlap pixel difference: **1.78%** (source 3,633px; app 3,633px high).

## Real-data limits

The phone reads existing SQLite snapshots, transactions, configuration, and wallet data. No persisted column or format was added.
The comparison fixture stores each monthly cash flow as priced transactions, so the production profit calculation reaches the source's +$188,809.27 net P&L and $265,000 added money. The range control and chart coordinates were checked against `getBoundingClientRect()` on the rendered source.
The chart and month cards request profit for calendar intervals. Year cards use a shared snapshot read for the annual result and its months, so their known P&L adds up without repeating the database scan.

## Remaining differences

- **8 Nov 2026 remeasurement at 390 × 844:** populated **7.545%** against a fresh Chromium render of `ds/pages/analyze-summary.html` (a pixel differs when any RGB channel differs by more than 20). Source: `.local/ui46-final/source-390-analyze-summary.html.png`; fresh app: `/tmp/fidelity/summary/summary-phone.png`; source bounds and computed styles: `/tmp/ui46-source-390-analyze-summary.html.json`; app bounds and computed-style assertions: `ios-fidelity-summary-layout.spec.ts`. Both first cards are x=16, y=168, 358 × 499; the heading, range and ATH also match their reference y positions. Visible differences remain: the app describes *known P&L* and *recorded cash flow* to avoid calling buys “money added”; this fixture correctly gives **+30.41% on $620,892** of opening value and recorded purchases, while the source says +32.84% on $575,000; break-even is still $575,000. The gain chart is green under the saved quote-colour rule, while the static source chart is blue. The source browser and app rasterize text differently even when both use the same locally bundled Public Sans WOFF2 bytes and computed font sizes. The working range, refresh and Analytics navigation retain their visible states. Below the first viewport, the required P&L explanation moves the month grid from source y=1151 to app y=1197, and year detail controls keep a 44 px tap target; these controls are absent from the static source.
- The year-card breakdown popover says staking rewards are unavailable instead of showing an amount. Stored transactions have no reward type, so an amount would guess which buys were staking rewards.
- UI24 re-rendered `ds/pages/analyze-summary.html` at 390 × 844 after merging #835. The first viewport differs by **6.807%** (maximum RGB channel difference over 20): `/tmp/ui24-current/source-390.png` versus `/tmp/fidelity/summary/summary-phone.png`. Both first cards now measure x=16, y=168, width=358, height=517; the chart starts at y=478 and the ATH card at y=697 in both. Most remaining pixels are text rasterization: the source loads Public Sans through Google's per-weight stylesheet, while Track3 bundles the same WOFF2 bytes for offline use. Applying the source stylesheet in a probe gave **2.143%**; equivalent local font-face declarations still gave **6.807%**. The app also draws the positive P&L chart line green under the global gain/loss colour rule from #835; the static source draws it blue. For a longer date range, the app shows three year cards per page and a pager; the static source shows its two sample years only.
- Re-rendered the source HTML and app on 6 Nov 2026 at 390 × 844. The first viewport differs by **1.15%** (maximum RGB-channel difference over 20). The isolated **Profit attribution** card differs by **9.74%** over the common 358 × 473 px area because the task requires 56 px tap rows instead of the source's 39 px rows, 16 px bars instead of 8 px bars, and a visible total amount column. Its Total range uses `$310K → $764K` when the source's full range would clip; the exact range is in the title. The **Top profit and loss coins** card differs by **1.95%** over 358 × 574 px after sizing the amount column to keep large CNY values on one line. Source and app card captures are in `/tmp/ui13-design-phone-*.png` and `/tmp/ui13-app-phone-*.png`.
- At 320 px, the smaller layout uses a narrower chart track and compact amount strings so full asset names, month P&L, and the Total row remain readable. The full amounts remain in titles. The design specification uses 390 px.
- The source and app heading and first card bounds match. The 47-group fixture displays a ten-row pager; the source page illustrates eight groups and has no equivalent large-data capture.
- The source manually lists non-stablecoin tickers in a chosen sequence in the month-note copy. Stored snapshots have no display-order field, so the app lists the profit engine's symbols in its stable order.
- The Analytics tab has a small upward chevron when Summary is open. It cues the existing tap-again menu for Wallets, Comparison, and Cost basis; the static source gives no hint that these destinations are available.
