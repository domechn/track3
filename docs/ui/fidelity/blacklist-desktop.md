# Blacklist desktop fidelity

See [Settings A shell](settings-a-shell-desktop.md). Viewed `blacklist-default`, `blacklist-empty`, `blacklist-undo`, and `blacklist-add-error` JPGs and read `ds/pages/settings-a-blacklist.html`. Main grid begins x 320, y 110, width 1252: 829px list card, 16px gap, 407px explanation card. The default list card is 334px high. Heading: “Blacklist / Tokens you chose to hide. **3 hidden**.” List top is a 70px input row with 20px side padding, 10px gap, a 40px `--sunken` text field (“Token symbol, for example SHIBAI”), and white 34px pill Hide token button. Four-column table header is 36px with 12px `--faint` type. Rows are 60px; footer has a top divider and 14px vertical padding.

Default table order is ETHG / “ERC20 · contract 0x9e1c…3b02” / 0x4f…a91c wallet / 18 Oct 2026; CLAIM-USDT / “ERC20 · contract 0x71af…c4d8” / same wallet / 11 Oct 2026; SHIBAI / Binance Alpha listing / Binance / 2 Oct 2026. Each ends with an outlined “Remove from blacklist” button. Footer “3 hidden tokens.” The right card title is “What hiding does” and has three icon rows: “Hidden tokens are left out of holdings, charts and totals. / The balance stays on the exchange or wallet.”; “Refreshes still read them. / Remove a token from the list and it returns on the next refresh.”; “Useful for fake airdrops and dust. / Never interact with tokens you did not buy.”

`blacklist-empty` has no table header/rows; a dashed box says “No hidden tokens / Tokens you hide, such as airdrop spam, are listed here. Hide one with its symbol above.” Header says “None hidden.” `blacklist-add-error` has ETHG in the red bordered field and a red inline message “ETHG is already on the blacklist.” above the table. `blacklist-undo` shows only ETHG and CLAIM-USDT, says “2 hidden”/“2 hidden tokens,” and has a bottom-right toast “Removed SHIBAI from the blacklist / It will show up again after the next refresh.” with Undo. Hiding and removing must use the existing blacklist configuration and refresh behaviour; dates and source links can only reflect fields the app actually stores.

## Remaining differences

**9 Nov 2026 layout audit:** blacklist 5.790% at 1280 × 800, dark, against the rendered source HTML (RGB channel difference sum > 60). The dense CNY fixture and working product state differ from the static reference; the page-specific visible differences are listed below.

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

The pixel ratios and screenshots for all four states are recorded in the capture table below. Each ratio counts pixels whose maximum RGB channel error exceeds 24, divided by the full 1600px capture area.

The persisted blacklist is an array of token symbols; it has no contract address, source identity, or date-hidden field. The reference's metadata beneath ETHG and CLAIM-USDT and its Seen in and Hidden since columns therefore display em dashes or “Token details unavailable” in the real UI. The `blacklist-undo` toast now has the source's title and second line. The table below records current ratios after these corrections.

## Capture results

| State | Pixel difference | App capture |
| --- | ---: | --- |
| `blacklist-default` | 3.45% | `/tmp/fidelity-desktop/blacklist/blacklist-default-desktop.png` |
| `blacklist-empty` | 2.76% | `/tmp/fidelity-desktop/blacklist/blacklist-empty-desktop.png` |
| `blacklist-add-error` | 3.45% | `/tmp/fidelity-desktop/blacklist/blacklist-add-error-desktop.png` |
| `blacklist-undo` | 2.35% | `/tmp/fidelity-desktop/blacklist/blacklist-undo-desktop.png` |
