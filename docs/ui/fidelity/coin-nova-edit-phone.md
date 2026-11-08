# coin-nova-edit phone design specification

References: `phone/records/coin-nova-edit-phone.jpg`.
Authoritative source: `source/ds/pages/records-coin-nova-edit.html`. Measured with getComputedStyle/getBoundingClientRect in headless Chromium, 390 × 844 viewport, device scale 1. Source scroll height: 1929px.

State: NOVA edit sheet includes the no-market-price banner, asset type and current price controls.

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
| `.head` | 16, 14, 358, 120 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 10px | Overview Coins NOVA Nova NOVA Custom asset Unlisted token in 0x4f…a91c · priced by hand Op |
| `.crumb` | 16, 14, 358, 18 | ; rgb(155, 157, 163); bg rgba(0, 0, 0, 0); padding 0px; gap 6px | Overview Coins NOVA |
| `h1` | 16, 36, 358, 28 | 600 22px / 28px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Nova NOVA Custom asset |
| `.sub` | 16, 66, 358, 18 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Unlisted token in 0x4f…a91c · priced by hand |
| `.actions` | 16, 94, 358, 40 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 10px | Open cost basis |
| `.card` | 16, 150, 358, 600 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Manual price $0.4210 Set by you, 12 Oct 2026 Price feed None 24h, 7D and 30D change are un |
| `.card` | 16, 762, 358, 380 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Price Manual NOVA has no market feed, so there is no price history. Value uses the price y |
| `.card` | 16, 1154, 358, 350.5 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Holdings by source 1 source 0x4f…a91c $5,052.00 12,000.00 NOVA · 100.0% · Wallet Total $5, |
| `.card` | 16, 1516.5, 358, 272 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 16px; gap normal | Transactions All 2 Buy 1 Deposit 1 Buy 4,000.00 NOVA $1,580.00 Edited · 30 Sep 2026 · 0x4f |
| `.ch` | 33, 407, 324, 30 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Position FIFO Range: All time |
| `.ch` | 33, 779, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Price Manual |
| `.ch` | 33, 1171, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Holdings by source 1 source |
| `.ch` | 33, 1353, 324, 20 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Open lots FIFO · 2 lots |
| `.ch` | 33, 1533.5, 324, 32 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 12px | Transactions All 2 Buy 1 Deposit 1 |
| `.card h2` | 33, 411, 59, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Position |
| `.card h2` | 33, 779, 37, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Price |
| `.card h2` | 33, 1171, 139, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Holdings by source |
| `.card h2` | 33, 1353, 70, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Open lots |
| `.card h2` | 33, 1538.5, 92, 20 | 600 15px / 20px "Public Sans"; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap normal | Transactions |
| `.kp6` | 33, 167, 324, 201 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 16px 0px | Manual price $0.4210 Set by you, 12 Oct 2026 Price feed None 24h, 7D and 30D change are un |
| `.kp6` | 33, 449, 324, 284 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 0px; gap 16px 0px | Positions 12,000.00 NOVA 1 source Cost price $0.3950 Avg. buy price (selected range) Price |
| `.prow` | 33, 1203, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | 0x4f…a91c $5,052.00 12,000.00 NOVA · 100.0% · Wallet |
| `.prow` | 33, 1267, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Total $5,052.00 12,000.00 NOVA |
| `.prow` | 33, 1577.5, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Buy 4,000.00 NOVA $1,580.00 Edited · 30 Sep 2026 · 0x4f…a91c · @ $0.3950 |
| `.prow` | 33, 1641.5, 324, 64 | ; rgb(255, 255, 255); bg rgba(0, 0, 0, 0); padding 12px 0px; gap 3px | Deposit 8,000.00 NOVA – 22 Aug 2026 · 0x4f…a91c |
| `.empty` | 33, 811, 324, 94 | ; rgb(180, 182, 188); bg rgba(0, 0, 0, 0); padding 28px; gap normal | NOVA has no market feed, so there is no price history. Value uses the price you set. |
| `.dialog` | 0, 50.6, 390, 793.4 | ; rgb(255, 255, 255); bg rgb(19, 18, 23); padding 8px 16px 28px; gap normal | Edit transaction Change how this transaction counts toward cost basis. Deposit 8,000.00 NO |

## Exact sample copy

Visible text from the rendered source page, top to bottom (including copy inside the source overlay where present):

### 1. head

```text
Overview
Coins
NOVA
Nova NOVA Custom asset
Unlisted token in 0x4f…a91c · priced by hand
Open cost basis
```

### 2. card s12

```text
Manual price
$0.4210
Set by you, 12 Oct 2026
Price feed
None
24h, 7D and 30D change are unavailable
Holdings value
$5,052.00
12,000.00 NOVA
Share of portfolio
–
Not in portfolio total
Position
FIFO
Range: All time
Positions
12,000.00 NOVA
1 source
Cost price
$0.3950
Avg. buy price (selected range)
Priced buys only: 4,000 of 12,000
Avg. sell price
–
No sales (selected range)
Breakeven price
–
Needs a price on every buy
Realized P&L
$0.00
Nothing sold
Unrealized P&L
–
Set the missing price first
```

### 3. card s7

```text
Price
Manual
NOVA has no market feed, so there is no price history. Value uses the price you set.
12 Oct 2026
Manual price
$0.4210
30 Sep 2026
From the buy of 4,000 NOVA
$0.3950
22 Aug 2026
Deposit, no price
–
Set current price
```

### 4. card s5

```text
Holdings by source
1 source
0x4f…a91c
$5,052.00
12,000.00 NOVA · 100.0% · Wallet
Total
$5,052.00
12,000.00 NOVA
Open lots
FIFO · 2 lots
Acquired	Quantity	Cost price	Unrealized
30 Sep 2026	4,000.00	$0.3950	+$104.00
22 Aug 2026	8,000.00	–	–
```

### 5. card s12

```text
Transactions
All 2
Buy 1
Deposit 1
Buy
4,000.00 NOVA
$1,580.00
Edited · 30 Sep 2026 · 0x4f…a91c · @ $0.3950
Deposit
8,000.00 NOVA
–
22 Aug 2026 · 0x4f…a91c
Edit changes the type or price a transaction counts with. Date, quantity and source come from the import and stay as they are.
```

### 6. dialog wide

```text
Edit transaction
Change how this transaction counts toward cost basis.
Deposit
8,000.00 NOVA
·
22 Aug 2026, 20:11
·
0x4f…a91c
NOVA has no market price
You set the prices for this asset: one per transaction here, and the current price below.
Type Changed from deposit
Buy
Sell
Deposit
Withdraw
Only buys and sells change cost basis. Deposits and withdrawals move assets between sources.
Price per NOVA
$
0.3600
USD per NOVA
Your own price on 22 Aug 2026.
Asset: NOVA
Asset type
Crypto
Current price
$0.4210
USD
Asset settings apply to every NOVA transaction.
Reset to imported
Cancel
Save
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

- App capture: `/tmp/fidelity/coin-nova/coin-nova-edit-phone.png`.
- Reference render: `/tmp/rev-fa3/design/records-coin-nova-edit.png`.
- Fresh 390 × 844 first-screen pixel difference: **9.33%** (RGB difference >20/255 in any channel).

## Real-data limits

The phone reads existing SQLite snapshots, transactions, snapshot edit logs, configuration, and wallet data. No persisted column or format was added. An edit is assigned to a row only when its snapshot, asset, and recorded current value identify one transaction; the public edit-log query has no transaction ID for ambiguous matches.

## Remaining differences

- The 8 Nov source-page and app edit-sheet viewports at 390 × 844, DPR 2,
  differ by **9.137%** at an RGB-channel threshold of 20. The last label
  starts at y=665 in both. The app uses a real input, functional save
  and reset controls, a retained scroll position, and the saved coin
  page behind the sheet; the design freezes its text and background.
  The Changed from label uses the shared theme tag, with a border and
  11 px text in place of the static 12 px dark pill.
- The reference uses static text in its price control. The app keeps an editable input for typing and saving, which rasterizes some text edges differently.
