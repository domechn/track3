# Backpack balance coverage

## Read and valuation

| Endpoint | Holdings represented | Valuation |
| --- | --- | --- |
| `GET /api/v1/capital` | Capital balance | `available + locked + staked` units by asset. |
| `GET /api/v1/borrowLend/positions` | Net borrow/lend positions | Add signed `netQuantity` units by symbol, retaining negative debt. |
| `GET /api/v1/position` | Position unrealized PnL | Add `pnlUnrealized` to USDC only when `marketType` is `PERP` or absent in the older response shape. Explicit non-PERP market types are excluded. The USDC denomination needs account verification. |
| `GET /api/v1/tickers` | USDC spot market pairs | Last price. Assets without a matched price remain unpriced. |

An optional lending or position failure marks a partial refresh and leaves capital balances intact.

## Not read

`GET /api/v1/capital/collateral` is not read because its `netEquity`, `lendQuantity`, `borrowLiability`, and `pnlUnrealized` may overlap the current capital, lending, and position reads. Non-PERP position PnL is not added.

## Not changed (needs real-account verification)

- Does `/capital.available` include already-lent quantities? With lending and a perpetual position, how do `lendQuantity` and `netQuantity` reconcile?
- Are borrowed positions always negative in `borrowLend.netQuantity`?
- Is `position.pnlUnrealized` denominated in USDC for every PERP market, and does `/capital` already include it?
- Which `marketType` values, including `IPERP` or `DATED`, represent equity that should be included without overlap?
- Can `/capital/collateral.netEquity` be used for reconciliation without counting collateral twice?
