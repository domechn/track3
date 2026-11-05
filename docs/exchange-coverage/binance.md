# Binance balance coverage

Balance quantities are kept in their asset or margin coin. The existing price pipeline prices those coins in USD; an asset without a quote remains unpriced. A failed optional read marks Binance partial and names the account type. A failed Spot read fails the refresh.

## Read

| Endpoint | Represents | Quantity used |
| --- | --- | --- |
| `GET /api/v3/account` | Spot wallet | `free + locked` per asset. Spot `LD*` receipt rows remain excluded by the existing portfolio filter. |
| `POST /sapi/v1/asset/get-funding-asset` | Funding wallet | `free + locked` per asset. |
| `GET /sapi/v1/simple-earn/locked/position` | Fixed-term Simple Earn | `amount` per asset, all pages. |
| `GET /sapi/v1/simple-earn/flexible/position` | Flexible Simple Earn | `totalAmount` per asset, all pages. |
| `GET /sapi/v1/margin/account` | Cross margin | `userAssets[].netAsset` per asset, after borrowing and interest. |
| `GET /sapi/v1/margin/isolated/account` | Isolated margin, separately per symbol pair | `assets[].baseAsset.netAsset` and `quoteAsset.netAsset`, summed by asset across pairs. `netAsset` includes the subtraction of borrowed principal and interest. |
| `GET /fapi/v2/balance` | USDⓈ-M futures wallet and cross position equity | `balance + crossUnPnl` per `asset`. `balance` is wallet balance; `crossUnPnl` is separate unrealized PnL. |
| `GET /fapi/v2/positionRisk` with `GET /fapi/v1/exchangeInfo` | USDⓈ-M isolated position PnL | Sum `unRealizedProfit` only when `marginType` is `isolated`. Match each position's `symbol` to exchange metadata's `marginAsset`; a missing mapping marks the account partial. Cross positions are omitted here because their PnL is already in `crossUnPnl`. The isolated wallet principal is already in `/fapi/v2/balance`. |
| `GET /dapi/v1/balance` | COIN-M futures wallet and cross position equity | `balance + crossUnPnl` per `asset`, in the coin margin asset. `balance` is wallet balance. |
| `GET /sapi/v1/dci/product/positions` | Active Dual Investment principal | Request `status=PURCHASE_SUCCESS`; sum `list[].subscriptionAmount` in `investCoin` over all pages. No yield or future exercised coin is guessed. |

Standalone negative net balances are retained within the Binance balance reader. The current portfolio representation discards negative-only asset rows, so such a row also marks its account type partial; the displayed total must not be treated as complete. Negative amounts offset positive quantities of the same asset before that check.

## Not changed (needs real-account verification)

| Area | Exact question to verify |
| --- | --- |
| Portfolio Margin: `GET /papi/v1/balance` and `GET /sapi/v1/portfolio/balance` | For a Portfolio Margin account, what does `/fapi/v2/balance` return, and would adding either Portfolio Margin endpoint count any of those assets twice? |
| On-chain yields: `GET /sapi/v1/onchain-yields/account` | Are its positions already represented by Spot receipt tokens or Simple Earn balances, and which quantities can be added without counting holdings twice? |
| SOL and ETH staking: `GET /sapi/v1/sol-staking/account` and `GET /sapi/v2/eth-staking/account` | Are BNSOL, WBETH, or other receipt tokens already in Spot or Earn, and which endpoint owns each underlying quantity? |
| Dual Investment states other than `PURCHASE_SUCCESS` | During `PENDING`, `SETTLING`, and `REFUNDING`, where is principal shown: Spot or Dual Investment? When is it safe to count each state without overlap? |
| COIN-M isolated positions | Does `balance + crossUnPnl` omit COIN-M isolated unrealized PnL, and which documented margin-asset field should supply it? |
| Unopened account responses | For an account never opened, do isolated margin, `/dapi/v1/balance`, and Dual Investment positions return an empty payload or an error code? The answer determines whether these reads should remain partial. Cross margin `-3003` and the prior Cross margin and USDⓈ-M `-2015`/401 paths remain silent. Should those permission paths continue to be treated as unopened accounts? |

## Not read

`GET /sapi/v1/asset/wallet/balance` reports wallet valuations across Spot, Funding, Margin, Futures, Earn, Options, Trading Bots, and Copy Trading. It is a reconciliation endpoint, not an asset-level balance source. Reconciliation is outside this task. Options, Trading Bots, and Copy Trading have no separately confirmed per-asset read in the audit.

Source fields and endpoint names follow the owner audit and Binance's official generated SDK schemas for futures balance, positionRisk v2, futures exchangeInfo, isolated margin, and Dual Investment positions. PositionRisk v3 has `marginAsset` but omits `marginType`, so this reader uses v2 and the public symbol metadata together. No real-account behavior was verified.
