# Profit calculation

P&L is calculated in USD for each pair of consecutive portfolio snapshots. A range includes an interval when its ending snapshot falls in the range. Its opening state is the last **whole snapshot before** the range start. If no earlier snapshot exists, the first snapshot establishes the opening holdings: recorded trades on it still count, but those holdings are not an unrecorded change. Attribution also starts at that first snapshot. A snapshot exactly at the range start contributes its incoming interval when a prior snapshot exists.

For each asset type and symbol, wallet quantities and values are combined before calculating the interval:

```
market move       = opening quantity × (closing price − opening price)
execution effect  = Σ signed transaction quantity × (closing price − transaction price)
unrecorded change = (closing quantity − opening quantity − Σ signed transaction quantity)
                    × closing price
```

Buys and deposits have positive signed quantities; sells and withdrawals have negative ones. The closing price for a zero balance uses its stored zero row, then a disposal transaction price, then the opening price. A new coin has zero opening quantity. A paired transfer across snapshots includes the price move while the asset is between wallets. The P&L is market move plus execution effect. Unrecorded change is shown separately and never enters P&L.

An unpaired withdrawal makes only its snapshot interval unknown for that coin. That interval contributes nothing to known P&L. Other intervals and coins remain in `knownTotal`. `total` is `null` when any interval is unknown, and the badge lists the coin, snapshot interval, and number of affected calendar months. A range and any partition of it sum the same known intervals. Annual known P&L therefore equals the sum of the twelve monthly known amounts to USD 0.01, including when an unknown withdrawal lands in one month.

The year card's recorded inflows are buys and deposits valued at their transaction prices, including the first interval of the year. Paired wallet transfers are excluded. The popover separately shows net trades and deposits marked as transfers in or rewards. The transaction schema has only `buy`, `sell`, `deposit`, and `withdraw`; auto-recorded staking rewards are buys and cannot be identified as staking rewards without new stored metadata. The popover therefore does not claim a separate numeric staking amount.

Fidelity Summary and the iPhone Analytics Returns sheet clip their month and year cards to the selected date range. The desktop Analytics Returns year view retains its calendar-year window.

The percentage denominator is opening value plus recorded buys and deposits at their transaction prices. When there is no earlier snapshot, holdings on the first snapshot that have no recorded acquisition form the opening value at that snapshot's price. Recorded acquisitions on that snapshot use their own prices. A partial range has no complete percentage. Coin average cost and sell price remain display statistics; they do not determine P&L. Asset type is part of the coin identity. Attribution's known P&L totals use the same interval calculator, including transactions between empty snapshots. Its residual contains unrecorded value and any value omitted because of an unknown interval.

The Summary P&L percentage's “on” amount uses that recorded opening and purchase capital. Its break-even portfolio value is the current value less P&L; the two amounts differ when holdings changed without a transaction. For example, one BTC at $100 followed by two BTC at $120 has $20 P&L, $120 unrecorded change, a 20% return on $100, and a $220 break-even portfolio value.

## Changed fixture expectations

- `charts-profit-numeric.test.ts`: the February first-refresh example changes 100 → 200; the midnight February example changes 10 → 60; both local-time boundary variants change February 10 → 40. These now include the interval ending at the range start, as required by the pre-range baseline rule.
- `charts-profit-numeric.test.ts`: an all-unknown withdrawal range retains a known amount of 0 instead of `null`. Withdrawal badges now include affected intervals and month counts. Other known amounts, including 28 and 30 in the daily withdrawal fixture, stay the same.
- `charts-interval-profit.test.ts`: the first-snapshot opening-holdings fixture now has a finite percentage denominator. For two BTC at $100 rising to $120, P&L is still $40 and the percentage is 20%; previously it was undefined.
- `charts-refresh-sell.test.ts`: the unpriced disappearance retains 150 of known P&L before the withdrawal, and the mixed-transfer example retains 190 around its unknown interval instead of nulling the coin. The card remains partial in both cases.
- `charts-asset-type.test.ts`: a stock quantity increase without a recorded buy changes 10 → 5 P&L and reports 15 as unrecorded. The crypto asset with the same symbol remains excluded by the stock filter.
- `charts-attribution.test.ts`: six original fixtures store transaction prices of zero. Those inputs remain unchanged and are valued at their own stored prices. The deposit's known P&L changes 40 → 160; the partial sale 60 → −60; a new asset bought at zero changes total known P&L 0 → 90 while the unpaired withdrawal remains unknown; the grouped fixture 0 → 120; the contradictory zero-price sale 20 → −100; and the mixed-case buy 20 → 140. Recorded flow and residual assertions change correspondingly so each still sums to the original snapshot value change. A separate nonzero execution-price case checks 70 P&L and 130 flow.
- `charts-attribution-data.test.ts`: without a prior snapshot, the first snapshot is the attribution baseline. Its initial 100 value is excluded from residual and `totalChange`; later recorded flow and market moves remain included.
- `charts-profit.test.ts`: API mocks now return snapshot groups and transaction groups used by the interval calculator. Its expected amounts did not change.
- `mobile/components/profit-attribution.test.tsx` and `components/profit-summary-hints.test.tsx`: copy expectations now identify recorded cash flow and the recorded buys in the percentage denominator.

## Changed e2e expectations

| Spec | Change and reason |
| --- | --- |
| `analyze-attribution.spec.ts` | Market/Quantity headers become Known P&L/Recorded cash flow; the BTC row gains a cell. With the July BTC transaction deleted, the Unexplained cell remains +$5,735.85. |
| `attribution-layout.spec.ts` | Year amount +¥206,596,023 → +¥170,976,019 follows additive interval P&L. The large attribution range keeps its earlier $12,006,602 opening snapshot. |
| `fidelity-summary-desktop.spec.ts` | The year count changes from coin counts to months up/down, the help copy explains stablecoin exclusion, and the two-snapshot line changes from neutral to gain. The approved $310,000 attribution opening and related coordinates are restored. The full Summary P&L percentage is +32.84% on $575,000 opening and recorded capital; previously the unrecorded first-snapshot opening holdings were missing from the denominator. |
| `ios-fidelity-summary-layout.spec.ts` | The All and 1Y total +$4,368.50 → +$5,714.69 and chart/leader assertions follow the interval calculation. The top-coin preview fixture now inserts each new coin into every snapshot, so a new symbol cannot appear as an unexplained late quantity change. The approved opening range, axis ticks, and coordinates are restored. Other changed assertions describe Known P&L and its date range. The full phone fixture displays +30.41% on $620,892 of opening value and recorded purchases, while the $575,000 net-flow amount is break-even. The source's +32.84% on $575,000 would use a different denominator. Card coordinates move with the longer accurate explanation. |
| `ios-attribution-layout.spec.ts` | The approved $310,000 and $12,006,602 opening ranges and their axis count are restored. |
| `ios-profit-hint-popover.spec.ts`, `profit-hint-popover.spec.ts` | The denominator explanation includes recorded buys as well as opening value and deposits. |
| `ios-profit-hint-popover.spec.ts` | The phone year card uses 200px height so the recorded-inflow breakdown keeps its 44px tap target. |
| `ios-attribution-layout.spec.ts`, `ios-summary-top-list-layout.spec.ts` | The phone top list includes flat stablecoin holdings; flat coins have no P&L entry but remain in the holdings preview. |
| `ios-profit-summary-partial.spec.ts`, `profit-summary-partial.spec.ts` | The hint explains exclusion of the affected snapshot interval, including its affected-month count. The iPhone spec also checks the P&L badge is inside the card. |
| `ios-summary-top-list-layout.spec.ts` | 1211.HK remains −94.54% after opening holdings are included in the denominator. The fixture ends at $6,328 with −$109,628 known P&L, so −$109,628 ÷ ($6,328 + $109,628) = −94.54%. An intermediate −99.66% expectation omitted opening holdings and was corrected. |
| `ios-ui-bugs.spec.ts` | The approved $5,781 opening range is restored; the total also states its +$470 known P&L. |
| `pnl-additive-intervals.spec.ts`, `ios-pnl-additive-intervals.spec.ts`, `pnl-additive-scenes.ts` | New desktop and phone fixtures check that visible month amounts add to the year amount. ETH moves from $100 to $120 during its unpaired withdrawal, then to $130, so the excluded interval changes the result; the known year amount is $409,328 after display rounding. A second phone scenario checks that an unrecorded quantity change does not dilute the P&L percentages on the Summary card, month, or year. |

The additive specs save screenshots in `.local/ui46-final/` so later Playwright runs do not clear them. The phone year footer now gives a zero month count the same muted tone as zero counts on the month cards; the phone additive spec checks its computed colour. The obsolete `ios-fidelity-summary.spec.ts` import-only stub was removed after its target file was renamed to `ios-fidelity-summary-layout.spec.ts`; the new spec is the mobile project's direct entry point.

No goldens, schema, or persisted portfolio format are changed. The total-profit cache key and attribution memory key are versioned so earlier results are not reused.

The `charts-profit.test.ts` mocks now supply `listLastSnapshotBefore` and grouped snapshot and transaction rows because the range calculator reads a complete prior snapshot and associates trades by snapshot UUID. The test's expected P&L values did not change.

The desktop cumulative chart now reads disjoint intervals and adds their known P&L, so it reads each snapshot interval once instead of rereading every earlier interval for each plotted point. Coin page P&L requests filter asset and transaction rows by symbol in SQL, and read the in-range snapshot IDs and dates separately. An empty coin group still marks an interval boundary when another asset occupied that snapshot. The desktop Returns year view reads one year of snapshots and transactions for its year amount and month counts, then calculates the thirteen overlapping ranges in memory. This keeps database row reads linear in the year’s history. Transfer pairing still considers seven days outside each individual range; tests cover paired transfers across a month boundary and a withdrawal paired outside the selected range. The transaction schema does not identify staking rewards separately from buys, so no standalone staking amount can be reported without new metadata.
