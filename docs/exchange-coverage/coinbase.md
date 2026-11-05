# Coinbase balance coverage

## Read and valuation

| Endpoint | Holdings represented | Valuation |
| --- | --- | --- |
| `GET /api/v3/brokerage/portfolios` | Active portfolio list | Select active `DEFAULT` and `INTX` portfolios. |
| `GET /api/v3/brokerage/portfolios/{uuid}` | Default portfolio spot | `breakdown.spot_positions[].total_balance_crypto` units by asset. |
| `GET /api/v3/brokerage/intx/balances/{uuid}` | INTX portfolio | `portfolio_balances[].balances[].quantity` units by asset. The path is retained pending retirement verification. HTTP 404 or 410 means unavailable; other errors mark Portfolio INTX unreadable while default balances remain. |

Coinbase currently supplies no exchange ticker prices to the common price pipeline. USDT receives the common unit price; other symbols remain unpriced unless priced elsewhere by the existing pipeline.

## Not read

Other portfolio breakdown sections (`perp_positions`, `futures_positions`, `prediction_markets_positions`, `equity_positions`), `portfolio_balances` totals, `/cfm/balance_summary`, `/cfm/positions`, and paginated `/accounts` are not read. Their relationship to the existing spot and INTX reads is unverified.

## Not changed (needs real-account verification)

- Are `/intx/*` endpoints retired for the relevant account type, and what authenticated Global Derivatives gateway call replaces this portfolio balance?
- Do staking, Coinbase One, cbETH, USDC rewards, and Vault assets appear in `spot_positions`?
- Do the other portfolio breakdown positions or `/cfm` balances overlap `spot_positions` or INTX balances?
- Are `/accounts.available_balance` and `hold` disjoint, or would summing them double count?
