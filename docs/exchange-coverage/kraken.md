# Kraken balance coverage

## Read and valuation

| Endpoint | Holdings represented | Valuation |
| --- | --- | --- |
| `POST /0/private/BalanceEx` | Spot balances and `.F`/`.B`/`.M` Earn, `.S` staked, and `.P` parachain-bonded balances | Use `balance` as owned units. `hold_trade` is already within `balance`; `credit` is ignored because it is not owned. Strip those documented suffixes and normalize `XBT`/`XXBT` to BTC and `XETH` to ETH. `ETH2.S` stays distinct. |
| `GET /0/public/Ticker` | USDT market pairs | Mid-price of bid and ask. An asset without a matched price remains unpriced. |

## Not read

Futures `GET /accounts`, `TradeBalance`, and `OpenPositions` are not read. Neither derivatives equity nor margin-position unrealized PnL is included. `.T` tokenized balances keep their suffix and may be unpriced.

## Not changed (needs real-account verification)

- With an open spot order, does `BalanceEx.balance` already include `hold_trade`?
- Does the base asset balance already include the `.F` Earn balance?
- Do `ETH2` and `ETH2.S` represent separate holdings, or would mapping both to ETH count the same ETH twice?
- Should a `.T` tokenized-asset suffix be stripped, and does its base symbol have the same price?
- Can the same spot API key access Futures `GET /accounts`, and which host and signing scheme does it require? Can its cash, margin, and multi-collateral accounts be added without overlap?
