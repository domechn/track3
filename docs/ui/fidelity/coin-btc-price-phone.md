# coin-btc-price phone design specification

References: `phone/records/coin-btc-price-phone.jpg`.
Authoritative source: `source/ds/pages/records-coin-btc-price.html`. Measured with getComputedStyle/getBoundingClientRect in headless Chromium, 390 × 844 viewport, device scale 1. Source scroll height: 2467px.

State: Price segmented view selected.

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
| `.head` | 16, 14, 358, 120 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 10px | Overview Coins BTC Bitcoin BTC Crypto Held on Binance and a Ledger cold wallet Open cost b |
| `.crumb` | 16, 14, 358, 18 | ; rgb(155, 157, 163); bg rgba(0, 0, 0, 0); padding 0px; gap 6px | Overview Coins BTC |
| `h1` | 16, 36, 358, 28 | 600 22px / 28px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Bitcoin BTC Crypto |
| `.sub` | 16, 66, 358, 18 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Held on Binance and a Ledger cold wallet |
| `.actions` | 16, 94, 358, 40 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 10px | Open cost basis |
| `.card` | 16, 150, 358, 586 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Bitcoin price $63,842.11 Per BTC, all sources 24h −0.05% −$32.91 7D +6.35% +$3,812.54 30D  |
| `.card` | 16, 748, 358, 378 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Price BTC in USD Value Price 7D 30D 58K 60K 62K 64K 24 Oct 26 Oct 28 Oct 31 Oct $63,842.11 |
| `.card` | 16, 1138, 358, 540.5 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Holdings by source 2 sources Binance $76,610.53 1.2000 BTC · 37.2% · Exchange Ledger cold  |
| `.card` | 16, 1690.5, 358, 688 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Transactions All 8 Buy 5 Sell 1 Deposit 1 Withdraw 1 Buy 0.1726 BTC $10,120.32 2 Oct 2026  |
| `.ch` | 33, 447, 324, 30 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Position FIFO Range: All time |
| `.ch` | 33, 765, 324, 43 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Price BTC in USD Value Price 7D 30D |
| `.ch` | 33, 1155, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Holdings by source 2 sources |
| `.ch` | 33, 1401, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Open lots FIFO · 5 lots |
| `.ch` | 33, 1707.5, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Transactions All 8 Buy 5 Sell 1 Deposit 1 Withdraw 1 |
| `.card h2` | 33, 451, 59, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Position |
| `.card h2` | 33, 770, 63, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Price |
| `.card h2` | 33, 1155, 139, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Holdings by source |
| `.card h2` | 33, 1401, 70, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Open lots |
| `.card h2` | 33, 1707.5, 92, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Transactions |
| `.kp6` | 33, 167, 324, 241 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 16px 0px | Bitcoin price $63,842.11 Per BTC, all sources 24h −0.05% −$32.91 7D +6.35% +$3,812.54 30D  |
| `.kp6` | 33, 489, 324, 230 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 16px 0px | Positions 3.2226 BTC 2 sources Cost price $53,647.29 Avg. buy price (selected range) Avg.  |
| `.prow` | 33, 1187, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Binance $76,610.53 1.2000 BTC · 37.2% · Exchange |
| `.prow` | 33, 1251, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Ledger cold wallet $129,127.05 2.0226 BTC · 62.8% · Wallet |
| `.prow` | 33, 1315, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Total $205,737.58 3.2226 BTC |
| `.prow` | 33, 1783.5, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Buy 0.1726 BTC $10,120.32 2 Oct 2026 · Binance · @ $58,634.52 |
| `.prow` | 33, 1847.5, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Sell 0.3500 BTC $24,850.00 8 Jun 2026 · Binance · @ $71,000.00 |
| `.prow` | 33, 1911.5, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Buy 0.5000 BTC $29,100.00 Edited · 9 Feb 2026 · Binance · @ $58,200.00 |
| `.prow` | 33, 1975.5, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Deposit 2.0226 BTC – 3 Feb 2025 · Ledger cold wallet ← Binance |
| `.prow` | 33, 2039.5, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Withdraw 2.0226 BTC – 3 Feb 2025 · Binance → Ledger cold wallet |

## Exact sample copy

Visible text from the rendered source page, top to bottom (including copy inside the source overlay where present):

### 1. head

```text
Overview
Coins
BTC
Bitcoin BTC Crypto
Held on Binance and a Ledger cold wallet
Open cost basis
```

### 2. card s12

```text
Bitcoin price
$63,842.11
Per BTC, all sources
24h
−0.05%
−$32.91
7D
+6.35%
+$3,812.54
30D
+7.32%
+$4,356.74
Holdings value
$205,737.58
3.2226 BTC
Share of portfolio
26.9%
of $763,809.27
Position
FIFO
Range: All time
Positions
3.2226 BTC
2 sources
Cost price
$53,647.29
Avg. buy price (selected range)
Avg. sell price
$71,000.00
1 sale (selected range)
Breakeven price
$51,762.65
Price is 23.3% above
Realized P&L
+$15,610.00
1 sale, FIFO
Unrealized P&L
+$23,317.28
Open lots at today's price
```

### 3. card s7

```text
Price
BTC in USD
Value
Price
7D
30D
58K
60K
62K
64K
24 Oct
26 Oct
28 Oct
31 Oct
$63,842.11
High
$63,875.02
30 Oct
Low
$60,029.57
24 Oct
Since 24 Oct
+$3,812.54
+6.35%
```

### 4. card s5

```text
Holdings by source
2 sources
Binance
$76,610.53
1.2000 BTC · 37.2% · Exchange
Ledger cold wallet
$129,127.05
2.0226 BTC · 62.8% · Wallet
Total
$205,737.58
3.2226 BTC
Open lots
FIFO · 5 lots
Acquired	Quantity	Cost price	Unrealized
20 Jun 2023	1.1500	$26,400.00	+$43,058.43
12 Mar 2024	0.8000	$68,900.00	−$4,046.31
14 Jan 2025	0.6000	$96,200.00	−$19,414.73
9 Feb 2026	0.5000	$58,200.00	+$2,821.06
2 Oct 2026	0.1726	$58,634.52	+$898.83
```

### 5. card s12

```text
Transactions
All 8
Buy 5
Sell 1
Deposit 1
Withdraw 1
Buy
0.1726 BTC
$10,120.32
2 Oct 2026 · Binance · @ $58,634.52
Sell
0.3500 BTC
$24,850.00
8 Jun 2026 · Binance · @ $71,000.00
Buy
0.5000 BTC
$29,100.00
Edited · 9 Feb 2026 · Binance · @ $58,200.00
Deposit
2.0226 BTC
–
3 Feb 2025 · Ledger cold wallet ← Binance
Withdraw
2.0226 BTC
–
3 Feb 2025 · Binance → Ledger cold wallet
Buy
0.6000 BTC
$57,720.00
14 Jan 2025 · Binance · @ $96,200.00
Buy
0.8000 BTC
$55,120.00
12 Mar 2024 · Binance · @ $68,900.00
Buy
1.5000 BTC
$39,600.00
20 Jun 2023 · Binance · @ $26,400.00
Edit changes the type or price a transaction counts with. Date, quantity and source come from the import and stay as they are.
```

## Controls, states, and formats

- Breadcrumbs: Overview › Coins › ticker. Title is full asset name, ticker in faint weight, then neutral category pill. Description sits below, then Open cost basis outline pill with dollar icon.
- First card order: price label/large currency price/subtitle; 24h or 1 day, 7D, 30D change cells (NOVA instead shows Price feed None); Holdings value and Share of portfolio; divider; Position header with FIFO and Range: All time select; two-column Position, Cost price, Avg. sell price, Breakeven price, Realized P&L, Unrealized P&L cells.
- Second card is Value of holdings or Price chart, with Value/Price and 7D/30D segmented controls, endpoint annotation and High/Low/Since stats. NOVA uses a dashed no-feed explanation and three dated price rows plus Set current price.
- Third card is Holdings by source as list rows with right-aligned USD values and quantity/share/source subtitle, then FIFO Open lots table. Fourth card is Transactions with counted type filter pills, 64px rows, right-aligned values, date/source/price subtitle and import-edit footnote.
- Quantity: BTC four decimals, NVDA integer, NOVA two decimals. Prices: BTC/NVDA two decimals, NOVA four decimals. Dates are `2 Oct 2026`; transaction sheet dates include `16:03`. Gains use signed USD and token `--positive`; losses use `--negative`; unavailable amounts are en dashes, never zero.
- Transaction rows open a bottom detail sheet. Edit type or price opens the edit sheet; Save uses existing transaction price/type updates. Cancel/Close dismiss. The edit sheet reads the existing snapshot edit log for an unambiguous original type and price; Reset restores those values through the saved transaction update commands. NOVA shows a no-market-price banner and its manually set price.

## Companion image states

Summary: full, one-snapshot empty and loading. Coin: BTC value and price, BTC transaction detail and edit sheets, NVDA, NOVA and NOVA edit sheet. No separate error image was supplied; retain existing error handling.

## Captured comparison

- App capture: `/tmp/fidelity/coin-btc/coin-btc-price-phone.png`.
- Reference render: `/tmp/rev-fa3/design/records-coin-btc-price.png`.
- Chart-card comparison: `/tmp/fidelity/coin-btc/coin-btc-price-card.png` against `/tmp/fa-current/design/btc-price-card-unobscured.png` (bottom navigation hidden in the source to expose the card).
- Fresh 390 × 844 first-screen pixel difference: **0.44%** (RGB difference >20/255 in any channel).

## Real-data limits

The phone reads existing SQLite snapshots, transactions, snapshot edit logs, configuration, and wallet data. No persisted column or format was added. An edit is assigned to a row only when its snapshot, asset, and recorded current value identify one transaction; the public edit-log query has no transaction ID for ambiguous matches.

## Remaining differences

- No missing product data or feature remains in this state. The chart card itself differs by 4.48% of pixels at the stated threshold, mostly along rendered text and SVG edges.
