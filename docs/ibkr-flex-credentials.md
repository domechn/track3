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
5. Copy the token and keep it somewhere safe.

## Step 2: Create a query and get its ID

The query tells IBKR which account data to send back.

1. On the same `Flex Queries` page, click the `+` button next to `Activity Flex Query`.
2. Give it a name, like `Current_Portfolio`.
3. Under `Sections`, turn on:
   - `Open Positions`
   - `Cash Report`
4. Under `Delivery Configuration`, set `Format` to `XML`.
5. Click `Continue`, then `Save`.
6. Back on the Flex Queries list, find your new query and click the `i` icon next to its name.
7. Copy the number at the top of the dialog — that's your query ID.

## What Track3 actually needs

- `Open Positions` turned on — without it, Track3 won't see your stock and ETF holdings.
- `Cash Report` turned on — lets Track3 pick up cash balances (and is useful for multi-currency accounts).
- `XML` format — Track3's IBKR importer only understands XML.

## Things to know

- Don't share your token. Not in screenshots, not in chat logs, not in support emails.
- IBKR throttles requests for the same query ID to roughly once every 3 minutes.
- New tokens and query templates are usually available right away, but sometimes IBKR takes a few minutes to sync.

## Multi-currency accounts

If you hold cash or positions in more than one currency, just make sure `Cash Report` is on. Track3 pulls currency breakdowns from that. You don't need a separate token or query for multi-currency.

## Entering credentials in Track3

Open the IBKR broker config in Track3 and paste in your token and query ID. Once both are saved, you can pull your IBKR Flex report from that screen.
