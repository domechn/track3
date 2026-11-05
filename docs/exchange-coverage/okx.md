# OKX balance coverage

The reader combines native coin amounts, then uses the existing exchange and portfolio price pipeline. A symbol with no price remains unpriced. No exchange total-valuation endpoint is used.

| Read | Represents | Amount used |
| --- | --- | --- |
| `GET /api/v5/account/balance` | Trading account | `details[].eq`, with the existing `availEq + frozenBal` or `cashBal + upl - liabilities - interest` fallback |
| `GET /api/v5/finance/savings/balance` | Flexible savings | `data[].amt` by `ccy` |
| `GET /api/v5/asset/balances` | Funding account | `data[].bal` by `ccy` |
| `GET /api/v5/finance/staking-defi/eth/balance` | ETH staking | `data[].amt` by `ccy`, with the existing trading/funding overlap adjustment |
| `GET /api/v5/finance/staking-defi/orders-active` and `/offers` | Active DeFi staking | `investData[].amt` by `ccy`, adjusted for the documented fast-redemption limit |
| `GET /api/v5/finance/sfp/dcd/order-history` | Live dual investments | `notionalSz` in `notionalCcy`, across all order pages |

## Not changed (needs real-account verification)

- `GET /api/v5/finance/staking-defi/sol/balance`: the official response's `data[].amt` is the **total OKSOL across trading, funding, and in-progress redemption**. Adding it to the already-read wallets double counts OKSOL. Question: with OKSOL in trading, funding, and redemption in turn, which portion of this total is absent from the current trading/funding/DeFi reads, and can it be identified without guessing?
- `GET /api/v5/finance/stable-rewards/balance`: `data[].details[].amt` is the **total stablecoin amount across trading, funding, and in-progress redemption**, not a separate reward-account principal. Its `totalEarnAccrual` is lifetime interest, not an extra balance. Question: for an earning stablecoin held in trading/funding and during redemption, which amount, if any, is outside the balances already read from trading, funding, savings, and DeFi?
- `GET /api/v5/finance/okusd/account`: `data[].amt` is an OKUSD balance aggregated at the master-account level and shared across subaccounts. Question: when OKUSD is held in trading/funding or a subaccount, what portion of this response is absent from this reader's wallet balances? Is a subaccount amount already present in another returned account?
- `/finance/flexible-loan/*`: collateral and liabilities are not incorporated. Question: for an active loan, where do its collateral and debt appear in `/account/balance` and the financing endpoints, and what net amount must be added or deducted?
- `/account/balance` `eq` versus `isoEq`: the existing choice and fallback remain intact. Question: does `eq` already include isolated equity and unrealised PnL for each instrument mode? Test against a real isolated position.

The cross-account endpoints above are documented in the [OKX API v5 financial product documentation](https://www.okx.com/docs-v5/en/). They were not added as extra sources because their documented totals overlap existing reads and the remaining part is not identified by the documentation.
