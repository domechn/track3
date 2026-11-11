# Setting up an IBKR Flex token and query ID

Track3 needs two things from your Interactive Brokers account: a **token** (to read your Flex Web Service data) and a **query ID** (to know which report to pull). You can grab both from the same page in IBKR Client Portal.

## Before you start

- Sign in to [IBKR Client Portal](https://ndcdyn.interactivebrokers.com).
- Go to `Performance & Reports` → `Flex Queries`.
- Keep this page open until you've copied both the token and query ID.

## Step 1: Get your token

Track3 uses the token to read your Flex query output.

1. On the `Flex Queries` page, look for `Flex Web Service` in the upper right.
2. Click the gear icon (`Configure`) next to it.
3. Make sure `Status` is `Enabled`.
4. If you don't have a token yet, click `Generate New Token`.
5. Set **Should Expire After** to the longest expiry you want (IBKR offers 6 hours to 1 year; the default is 6 hours). Leave **Valid For IP Address** empty unless you have a fixed IP address for this device.
6. Copy the token and keep it somewhere safe. Generating a new token invalidates the current one, so replace the saved token in Track3 immediately.

## Step 2: Create a query and get its ID

The query tells IBKR which account data to send back.

1. On the same `Flex Queries` page, click the `+` button next to `Activity Flex Query`.
2. Give it a name, like `Current_Portfolio`.
3. Under `Sections`, turn on:
   - `Open Positions`
   - `Cash Report`, with **Currency Breakout**
   - `Account Information`
4. Under `Delivery Configuration`, set `Format` to `XML`.
5. Click `Continue`, then `Save`.
6. Back on the Flex Queries list, find your new query and click the `i` icon next to its name.
7. Copy the number at the top of the dialog — that's your query ID.

## What Track3 actually needs

- `Open Positions` turned on — without it, Track3 won't see your stock and ETF holdings.
- `Cash Report` with **Currency Breakout** — gives Track3 one ending cash balance per currency. The `BASE_SUMMARY` amount is a total in the account's base currency; Track3 does not add it on top of breakout rows.
- `Account Information` — provides the base currency when a Cash Report has only `BASE_SUMMARY`. Without it or Currency Breakout, Track3 omits the cash and marks the source partial rather than treating the number as USD.
- `XML` format — Track3's IBKR importer only understands XML.

## Things to know

- Don't share your token. Not in screenshots, not in chat logs, not in support emails.
- IBKR limits the Flex Web Service token to **1 request per second** and **10 requests per minute** across SendRequest and GetStatement. Track3 applies those limits locally. After error 1018, it waits 60 seconds for one retry.
- New tokens and query templates are usually available right away, but sometimes IBKR takes a few minutes to sync.

## Multi-currency accounts

If you hold cash in more than one currency, enable **Currency Breakout** in the Cash Report. Track3 combines each currency separately across accounts and converts it to USD with the app's saved currency rates. A missing rate means that cash currency is omitted with a partial warning. You don't need a separate token or query for multi-currency.

## Asset coverage

Track3 reads `STK` shares and ETFs as stocks. It maps IBKR `CRYPTO` symbols **BTC, ETH, LTC, BCH** to the app's existing coin pricing. It includes `FUND` only when the stock pricing service returns a valid price for its symbol. `BOND`, `OPT`, `FOP`, `FUT`, `WAR`, `CASH` (forex), and other unsupported categories are omitted and counted in a partial warning; their quantities alone are insufficient to value them safely.

## Flex Web Service errors

These codes and meanings come from [IBKR's official Flex Web Service error-code list](https://www.interactivebrokers.com/docs/web-api/flex-web-service/error-codes). Track3 displays an action in the source status and records the raw numeric code in the log without the token.

| Code | IBKR meaning | What to do |
| --- | --- | --- |
| 1012 | Token has expired | Generate a new token in Client Portal → Performance & Reports → Flex Queries; choose the longest expiry and save the new token in Track3. |
| 1013 | IP restriction | Clear **Valid For IP Address**, or access from the allowed IP. |
| 1010, 1014 | Legacy query unsupported; invalid query | Create an Activity Flex Query and check its ID. |
| 1015 | Invalid token | Copy and save the current Flex Web Service token. |
| 1011, 1016 | Service account inactive; account invalid | Check the account and enable Flex Web Service. |
| 1017 | Invalid reference code | Check the query ID and try generating a fresh report. |
| 1018 | Too many requests from the token | Track3 retries once after 60 seconds; if it persists, try refreshing again in a minute. |
| 1001, 1003–1009, 1019, 1021 | Statement unavailable, incomplete, or still generating | Try refreshing again shortly. Only 1019 is polled as generation in progress. |

IBKR [requires a User-Agent header](https://www.interactivebrokers.com/docs/web-api/flex-web-service/using-flex-web-service). Track3 passes `Track3/<app version>` through `@tauri-apps/plugin-http` for both Flex endpoints. The request payload is covered by a local test; whether the installed plugin sends that header on a real device and the entire IBKR integration remain **unverified against a real IBKR account**.

## Entering credentials in Track3

Open the IBKR broker config in Track3 and paste in your token and query ID. Once both are saved, you can pull your IBKR Flex report from that screen.
