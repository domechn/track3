# HTX balance coverage

The reader combines native coin amounts, then uses the existing exchange and portfolio price pipeline. A symbol with no price remains unpriced. Negative equity offsets positive HTX balances for the same symbol. If the merged amount is still negative, the refresh cannot save that debt and marks HTX partial. Optional account failures also mark the HTX source partial and name the account; successful balances still count.

| Read | Represents | Amount used |
| --- | --- | --- |
| `GET /v1/account/accounts` then `GET /v1/account/accounts/{id}/balance` | First working spot account | Existing sum of `list[].balance` by `currency` |
| Same account-balance endpoint for `deposit-earning` and `investment` | Earn accounts | Sum of `list[].balance` by `currency` |
| Same account-balance endpoint for `super-margin` and `cross-margin` | Cross margin | `trade + frozen + lock - abs(loan) - abs(interest)` by `currency`; `bank` excluded |
| Same account-balance endpoint for working `margin` accounts | Isolated spot margin | `trade + frozen + lock - abs(loan) - abs(interest)` by `currency`; `bank` excluded |
| `POST /linear-swap-api/v1/swap_account_info` | USDT isolated perpetuals | Sum of `margin_balance` in USDT, including negative equity |
| `POST /linear-swap-api/v1/swap_cross_account_info` | USDT cross perpetuals | Sum of account-level `margin_balance` in USDT, including negative equity; `contract_detail` is not added again |
| `POST /swap-api/v1/swap_account_info` | Coin-margined perpetuals | Account-level `margin_balance` by `symbol` |
| `POST /api/v1/contract_account_info` on `api.hbdm.com` | Coin-margined delivery contracts | Account-level `margin_balance` by `symbol`; the documented equity field already includes unrealised PnL |

The [HTX spot account documentation](https://huobiapi.github.io/docs/spot/v1/en/) lists `lock` and `bank` as balance types without defining either as user equity. Margin includes `lock` to match the existing spot reader, which sums every balance type including `bank`. Margin excludes `bank` pending real-account verification. The [HTX coin-margined delivery documentation](https://huobiapi.github.io/docs/dm/v1/en/) defines `margin_balance` as account equity, equal to `margin_static + profit_unreal`. The reader does not sum those fields a second time. These endpoints have no pagination.

## Not changed (needs real-account verification)

- Net-negative merged symbols: the refresh discards negative rows, so the debt does not reduce the saved portfolio total. Keep the source partial until refresh supports signed holdings.
- `lock` and `bank` balances: are they additional user-owned assets or internal balances that overlap `trade`/`frozen`? Compare all balance types with the exchange account total before changing either.
- Unopened contracts: what do `swap_account_info`, `swap_cross_account_info` and `contract_account_info` return for an account that never opened contracts? The documented 1010 and 1012 responses are treated as empty accounts.
- `otc`, `point` (`/v2/point/account`), `borrow`, `minepool`, `etf`, `crypto-loans`, `grid-trading`, and `otc-options`: for each account type, does the API return a distinct user-owned asset balance, and what debt or transfer overlap must be removed? The options response was not verified in the audit.
- Unified USDT account: do the legacy USDT isolated and cross swap endpoints return its complete balance, and do they overlap each other for a unified-account user?
- USDT and coin-margined perpetual `margin_balance`: does each endpoint's `margin_balance` include `profit_unreal`? Do not add `profit_unreal` without checking the account-equity equation on a real position.
- First working spot account: can more than one working `spot` account appear for the same user, and if so, are their balances distinct?
