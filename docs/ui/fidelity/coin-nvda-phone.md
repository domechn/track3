# coin-nvda phone design specification

References: `phone-long/records/coin-nvda-phone-long.jpg` and `phone/records/coin-nvda-phone.jpg`.
Authoritative source: `source/ds/pages/records-coin-nvda.html`. Measured with getComputedStyle/getBoundingClientRect in headless Chromium, 390 × 844 viewport, device scale 1. Source scroll height: 1964px.

State: NVIDIA stock: same structure as BTC, stock units and one source.

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
| `.head` | 16, 14, 358, 120 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 10px | Overview Coins NVDA NVIDIA NVDA Stock NVIDIA Corporation · held at Interactive Brokers Ope |
| `.crumb` | 16, 14, 358, 18 | ; rgb(155, 157, 163); bg rgba(0, 0, 0, 0); padding 0px; gap 6px | Overview Coins NVDA |
| `h1` | 16, 36, 358, 28 | 600 22px / 28px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | NVIDIA NVDA Stock |
| `.sub` | 16, 66, 358, 18 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 0px; gap normal | NVIDIA Corporation · held at Interactive Brokers |
| `.actions` | 16, 94, 358, 40 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 10px | Open cost basis |
| `.card` | 16, 150, 358, 586 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | NVIDIA price $141.25 NASDAQ · delayed 15 min 1 day −1.45% −$2.08 7D +1.74% +$2.42 30D +4.0 |
| `.card` | 16, 748, 358, 417 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Value of holdings Current holdings (220 NVDA) at each day's price Value Price 7D 30D 28K 2 |
| `.card` | 16, 1177, 358, 350.5 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Holdings by source 1 source Interactive Brokers $31,075.00 220 NVDA · 100.0% · Broker Tota |
| `.card` | 16, 1539.5, 358, 336 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Transactions All 3 Buy 2 Sell 1 Sell 30 NVDA $4,137.00 15 Jul 2026 · Interactive Brokers · |
| `.ch` | 33, 447, 324, 30 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Position FIFO Range: All time |
| `.ch` | 33, 765, 324, 82 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Value of holdings Current holdings (220 NVDA) at each day's price Value Price 7D 30D |
| `.ch` | 33, 1194, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Holdings by source 1 source |
| `.ch` | 33, 1376, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Open lots FIFO · 2 lots |
| `.ch` | 33, 1556.5, 324, 32 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Transactions All 3 Buy 2 Sell 1 |
| `.card h2` | 33, 451, 59, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Position |
| `.card h2` | 33, 765, 276, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Value of holdings |
| `.card h2` | 33, 1194, 139, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Holdings by source |
| `.card h2` | 33, 1376, 70, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Open lots |
| `.card h2` | 33, 1561.5, 92, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Transactions |
| `.kp6` | 33, 167, 324, 241 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 16px 0px | NVIDIA price $141.25 NASDAQ · delayed 15 min 1 day −1.45% −$2.08 7D +1.74% +$2.42 30D +4.0 |
| `.kp6` | 33, 489, 324, 230 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 16px 0px | Positions 220 NVDA 1 source Cost price $76.28 Avg. buy price (selected range) Avg. sell pr |
| `.prow` | 33, 1226, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Interactive Brokers $31,075.00 220 NVDA · 100.0% · Broker |
| `.prow` | 33, 1290, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Total $31,075.00 220 NVDA |
| `.prow` | 33, 1600.5, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Sell 30 NVDA $4,137.00 15 Jul 2026 · Interactive Brokers · @ $137.90 |
| `.prow` | 33, 1664.5, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Buy 100 NVDA $11,840.00 6 May 2025 · Interactive Brokers · @ $118.40 |
| `.prow` | 33, 1728.5, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Buy 150 NVDA $7,230.00 24 Oct 2023 · Interactive Brokers · @ $48.20 |

## Exact sample copy

Visible text from the rendered source page, top to bottom (including copy inside the source overlay where present):

### 1. head

```text
Overview
Coins
NVDA
NVIDIA NVDA Stock
NVIDIA Corporation · held at Interactive Brokers
Open cost basis
```

### 2. card s12

```text
NVIDIA price
$141.25
NASDAQ · delayed 15 min
1 day
−1.45%
−$2.08
7D
+1.74%
+$2.42
30D
+4.04%
+$5.48
Holdings value
$31,075.00
220 NVDA
Share of portfolio
4.1%
of $763,809.27
Position
FIFO
Range: All time
Positions
220 NVDA
1 source
Cost price
$76.28
Avg. buy price (selected range)
Avg. sell price
$137.90
1 sale (selected range)
Breakeven price
$67.88
Price is 108.1% above
Realized P&L
+$2,691.00
1 sale, FIFO
Unrealized P&L
+$13,451.00
Open lots at today's price
```

### 3. card s7

```text
Value of holdings
Current holdings (220 NVDA) at each day's price
Value
Price
7D
30D
28K
29K
30K
31K
32K
1 Oct
11 Oct
21 Oct
31 Oct
$31,075
High
$31,532.60
30 Oct
Low
$28,949.80
16 Oct
Since 1 Oct
+$1,205.60
+4.04%
```

### 4. card s5

```text
Holdings by source
1 source
Interactive Brokers
$31,075.00
220 NVDA · 100.0% · Broker
Total
$31,075.00
220 NVDA
Open lots
FIFO · 2 lots
Acquired	Quantity	Cost price	Unrealized
24 Oct 2023	120	$48.20	+$11,166.00
6 May 2025	100	$118.40	+$2,285.00
```

### 5. card s12

```text
Transactions
All 3
Buy 2
Sell 1
Sell
30 NVDA
$4,137.00
15 Jul 2026 · Interactive Brokers · @ $137.90
Buy
100 NVDA
$11,840.00
6 May 2025 · Interactive Brokers · @ $118.40
Buy
150 NVDA
$7,230.00
24 Oct 2023 · Interactive Brokers · @ $48.20
Edit changes the type or price a transaction counts with. Date, quantity and source come from the import and stay as they are.
```

## Controls, states, and formats

- Breadcrumbs: Overview › Coins › ticker. Title is full asset name, ticker in faint weight, then neutral category pill. Description sits below, then Open cost basis outline pill with dollar icon.
- First card order: price label/large currency price/subtitle; 24h or 1 day, 7D, 30D change cells (NOVA instead shows Price feed None); Holdings value and Share of portfolio; divider; Position header with FIFO and Range: All time select; two-column Position, Cost price, Avg. sell price, Breakeven price, Realized P&L, Unrealized P&L cells.
- Second card is Value of holdings or Price chart, with Value/Price and 7D/30D segmented controls, endpoint annotation and High/Low/Since stats. NOVA uses a dashed no-feed explanation and three dated price rows plus Set current price.
- Third card is Holdings by source as list rows with right-aligned USD values and quantity/share/source subtitle, then FIFO Open lots table. Fourth card is Transactions with counted type filter pills, 64px rows, right-aligned values, date/source/price subtitle and import-edit footnote.
- The 324px open-lot table uses 82px, 65px, 74px and 103px columns, with 42px rows. Acquisition dates fit on one line.
- Quantity: BTC four decimals, NVDA integer, NOVA two decimals. Prices: BTC/NVDA two decimals, NOVA four decimals. Dates are `2 Oct 2026`; transaction sheet dates include `16:03`. Gains use signed USD and token `--positive`; losses use `--negative`; unavailable amounts are en dashes, never zero.
- Transaction rows open a bottom detail sheet. Edit type or price opens the edit sheet; Save uses existing transaction price/type updates. Cancel/Close dismiss. The edit sheet reads the existing snapshot edit log for an unambiguous original type and price; Reset restores those values through the saved transaction update commands. NOVA shows a no-market-price banner and its manually set price.

## Companion image states

Summary: full, one-snapshot empty and loading. Coin: BTC value and price, BTC transaction detail and edit sheets, NVDA, NOVA and NOVA edit sheet. No separate error image was supplied; retain existing error handling.

## Captured comparison

- App capture: `/tmp/fidelity/coin-nvda/coin-nvda-phone-long.png`.
- Reference render: `/tmp/rev-fa3/design/records-coin-nvda-long.png`.
- Fresh 390 × 844 first-screen pixel difference: **1.07%** (RGB difference >20/255 in any channel).
- Full-page overlap pixel difference: **3.89%** (source 1,964px; app 1,964px high).

## Real-data limits

The phone reads existing SQLite snapshots, transactions, snapshot edit logs, configuration, and wallet data. No persisted column or format was added. An edit is assigned to a row only when its snapshot, asset, and recorded current value identify one transaction; the public edit-log query has no transaction ID for ambiguous matches.

## Remaining differences

- The saved alias is “NVIDIA”; no separate “NVIDIA Corporation” name is stored for the subtitle.
- The saved stock record has no exchange or quote-delay fields, so it cannot substantiate the source’s “NASDAQ · delayed 15 min” price caption. The chart uses dated stored snapshots.
