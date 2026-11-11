# Bitget balance coverage

## Read

| Endpoint | Account represented | Valuation |
| --- | --- | --- |
| `GET /api/v2/spot/account/assets` | Spot | `available + locked + frozen` by `coin`. |
| `GET /api/v2/mix/account/accounts?productType=USDT-FUTURES` | USDT futures, all returned margin coins | `accountEquity` in `marginCoin`, including unrealised PnL. |
| `GET /api/v2/mix/account/accounts?productType=COIN-FUTURES` | Coin futures, all returned margin coins | `accountEquity` in `marginCoin`, including unrealised PnL. |
| `GET /api/v2/mix/account/accounts?productType=USDC-FUTURES` | USDC futures, all returned margin coins | `accountEquity` in `marginCoin`, including unrealised PnL. |
| `GET /api/v2/earn/account/assets` | Existing Earn account read | `amount` by `coin`. |
| `GET /api/v2/earn/elite/assets` | Classic On-chain Earn (Elite) | `exchangeAmount` in `subscriptionCoin`, after checking it against `holdingAmount × exchangeRate` within 1%. |
| `GET /api/v3/earn/elite-assets` | UTA On-chain Earn (Elite) | Same quantity rule; items also returned by the classic endpoint count once. |
| `GET /api/v2/margin/crossed/account/assets` | Cross margin | `net`, or the existing available/frozen minus borrow/interest fallback. |

Each futures product is optional and reported separately when it fails. API response codes other than `00000`, including `700011`, mark the account unreadable. Earn and cross margin API code failures are also reported. On-chain Earn is partial if neither elite endpoint can be read or an item has an invalid quantity; an error from one endpoint alone does not make the source partial when the other succeeds. An elite item already listed by Earn with the same subscription coin and amount within 0.5% counts once. Spot failure keeps other nonempty balances and marks Spot unreadable. If Spot fails and no other account has a nonzero balance, the exchange source fails. Prices use the existing USDT ticker and portfolio price pipeline; assets with no price remain unpriced.

The elite endpoint fields and conversion rule above are derived from Bitget documentation. The documented limit is 5 requests/s/UID; v2 requires **Spot Trading (Read Only)** and v3 requires **UTA mgt. (read)**. They are **unverified on a real Bitget account**.

The portfolio display currently drops a negative-only holding. If an account has net negative equity, source status marks **Some assets** unreadable so the displayed total is not presented as complete.

`GET /api/v2/account/all-account-balance` reports aggregate USDT estimates that overlap the account reads; it is not added as a holding.

## Real-account questions for current reads

For each endpoint below, does an account that was never opened, or an API key without its read permission, return an error code or an empty data list? Test both conditions separately:

- Spot: `GET /api/v2/spot/account/assets`
- USDT futures: `GET /api/v2/mix/account/accounts?productType=USDT-FUTURES`
- Coin futures: `GET /api/v2/mix/account/accounts?productType=COIN-FUTURES`
- USDC futures: `GET /api/v2/mix/account/accounts?productType=USDC-FUTURES`
- Earn: `GET /api/v2/earn/account/assets`
- Classic On-chain Earn: `GET /api/v2/earn/elite/assets`
- UTA On-chain Earn: `GET /api/v3/earn/elite-assets`
- Cross margin: `GET /api/v2/margin/crossed/account/assets`

For both elite endpoints, confirm the documented `resultList` fields, read permissions, classic versus UTA availability, and whether `/api/v2/earn/account/assets` repeats the same positions. These checks are unverified on a real account.

## Not changed (needs real-account verification)

- Funding `GET /api/v2/account/funding-assets`: What are the exact response fields for each asset, and does this endpoint overlap Spot or Earn?
- Savings `GET /api/v2/earn/savings/assets`: What are its response fields, and are its balances already included by `/api/v2/earn/account/assets`? The audit checked the path through ccxt, not the response.
- Bot `GET /api/v2/account/bot-assets`: What fields represent owned equity, and do bot assets overlap Spot or futures?
- Cash+ (UTA) `GET /api/v3/earn/cashplus/positions`: The documented `balance` is USD-converted, with no coin quantity. Follow up when the portfolio can represent a USD-valued position without inventing a coin balance.
- SharkFin `GET /api/v2/earn/sharkfin/assets` (and its account endpoint): What are the documented response fields and the overlap with the existing Earn account read?
- Isolated margin `GET /api/v2/margin/isolated/account/assets`: What fields represent net equity after debt, and does the balance overlap Spot or cross margin?
- Union-margin `assetList`: What are the documented per-asset fields and their relationship to `accountEquity`? Can a classic single-asset account also return a nonempty `assetList`, and does `assetMode` distinguish it? Rows with a nonempty `assetList` are left unvalued and reported as unreadable until this is known.
- UTA: **Can a real UTA account read its complete balance using the v2 Spot and mix balance endpoints, or must it use `GET /api/v3/account/assets`?** Compare with `GET /api/v3/account/settings` `accountMode` and v3 `accountEquity` before changing the reader.
- Classic futures: With a live position, confirm that `accountEquity` is in `marginCoin` and includes unrealised PnL for each of the three product types. Does classic `available` include unrealised PnL?
