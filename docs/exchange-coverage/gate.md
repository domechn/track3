# Gate.io balance coverage

## Read and valuation

| Endpoint | Holdings represented | Valuation |
| --- | --- | --- |
| `GET /spot/accounts` | Spot | `available + locked` units by currency. |
| `GET /earn/uni/lends` | Flexible Earn | `amount` units by currency. |
| `GET /earn/fixed-term/user/lend` | Fixed-term Earn orders, all pages | Sum `principal` units by asset. |
| `GET /earn/staking/assets` | Single-coin staking | `mortgage_amount` units for one `mortgage_coin`; multi-coin entries are skipped because allocation is unknown. |
| `GET /earn/dual/balance` | Dual investment | `user_asset_usdt` is the USDT principal estimate. `user_total_interest_usdt` is cumulative interest and is not added. Missing principal is a partial failure. |
| `GET /portfolio/accounts` | Portfolio margin account | `available` units by asset. |
| `GET /margin/accounts` | Margin pairs | Each leg uses `available + locked - borrowed - interest` units. |
| `GET /wallet/total_balance` | Futures, delivery futures, options, payment, and quant details | Each selected detail's `amount` in its `currency` is an exchange estimate. The endpoint's exchange rate can be cached for up to one minute. `unrealised_pnl` is not added because whether `amount` includes it is unverified. |
| `GET /spot/tickers` | USDT spot market pairs | Last price. Assets without a matched price remain unpriced. |

An optional account failure keeps other balances and marks the source partial. A wallet-total failure names the wallet-total account group in source status.

## Not read

`cross_margin` from wallet details is skipped because `/margin/accounts` may cover it. `finance` is skipped because it may overlap Earn. `spot` and `margin` wallet estimates are skipped because dedicated reads cover them. `meme_box` (Alpha), `warrant`, and `cbbc` are not added without verified ownership and valuation semantics. Unified `/unified/accounts`, `/earn/structured/orders`, launchpool, HODLer, and copy-trading balances are not read.

## Not changed (needs real-account verification)

- Does dual-investment principal also appear in spot or another Earn account?
- For a unified account, do `/spot/accounts` and `/margin/accounts` still return its assets, and would `/unified/accounts` overlap them?
- Does wallet `cross_margin` include the balances returned by `/margin/accounts`?
- Does wallet `finance` include `/earn/uni/lends` or other Earn balances?
- Does wallet `delivery.amount` include `unrealised_pnl`?
- How should multi-coin `mortgage_coin` staking amounts be allocated to individual coins?
- Are `meme_box`, `warrant`, and `cbbc` wallet details disjoint from the accounts already read?
