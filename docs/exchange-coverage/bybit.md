# Bybit balance coverage

## Read

| Endpoint | Account represented | Valuation |
| --- | --- | --- |
| `GET /v5/account/wallet-balance?accountType=UNIFIED` | Unified spot, derivatives, and options | Per-coin `equity`, including unrealised PnL; existing `walletBalance` fallback retained. |
| `GET /v5/asset/transfer/query-account-coins-balance?accountType=FUND` | Funding account | Per-coin `walletBalance`. `transferBalance` is a subset and is not added. |
| `GET /v5/earn/position?category=FlexibleSaving` | Flexible saving | Per-coin `amount`. |
| `GET /v5/earn/position?category=OnChain` | On-chain Earn | Per-coin `amount`. |
| `GET /v5/earn/advance/position?category=DualAssets` | Dual asset Earn | `investCoin` and `amount`. |

Funding and Earn calls are optional. A failed Funding call keeps the other balances and marks Funding unreadable in source status. Prices use the existing exchange ticker and portfolio price pipeline; assets with no price remain unpriced.

`totalEquity` is a UNIFIED account summary, so it is not added to per-coin balances.

## Real-account question for Funding

For `GET /v5/asset/transfer/query-account-coins-balance?accountType=FUND`, does a never-opened FUND account return an error code or an empty `balance` list? Does an API key without permission to read FUND return an error code or an empty list?

## Not changed (needs real-account verification)

- Other Earn categories: Which Bybit Earn products, if any, are outside `FlexibleSaving`, `OnChain`, and `DualAssets`, and do their balances overlap these reads?
- FUND overlap: For an account holding the same coin in FUND and UNIFIED, do the two endpoint balances represent separate assets after a transfer?
