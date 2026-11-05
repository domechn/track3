# MEXC balance coverage

## Read and valuation

| Endpoint | Holdings represented | Valuation |
| --- | --- | --- |
| `GET /api/v3/account` | Spot | `free + locked` units by asset. |
| `GET /api/v3/margin/account` | Suspected cross margin | `netAsset`, or `free + locked - borrowed - interest` when absent. Its existence is unverified; HTTP 404 means unavailable. Other failures, including `700011`, mark cross margin unreadable. |
| `GET /api/v3/margin/isolated/account` | Suspected isolated margin | Same net-unit rule. Its existence is unverified; HTTP 404 means unavailable. Other failures mark isolated margin unreadable. |
| `GET /api/v1/private/account/assets` | Futures | `equity` units by currency when present. The existing fallback of `availableBalance + frozenBalance + unrealized` remains; its accounting semantics need verification. Failures mark futures unreadable. |
| `GET /api/v3/ticker/price` | USDT market pairs | Pair price. Assets without a matched price remain unpriced. |

Spot remains the required source. A non-404 optional-account failure marks a partial refresh while preserving balances from working accounts.

## Not read

Earn, staking, copy trading, and subaccount balances are not read. The audit did not confirm a suitable balance endpoint for them.

## Not changed (needs real-account verification)

- With an authenticated account, do `/api/v3/margin/account` and `/api/v3/margin/isolated/account` exist, and what response fields and permissions do they return?
- Does futures `equity` include `unrealized` and trial `bonus`? Is trial bonus withdrawable owned equity?
- Does `availableBalance` include `positionMargin`, making the existing fallback formula double count or omit margin?
