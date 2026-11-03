# Add source desktop fidelity

See [Settings A shell](settings-a-shell-desktop.md). Viewed all fifteen `add-*-desktop.jpg` references and read `ds/pages/settings-a-add.html`, `settings-a.js`, and `settings-a.css`. The backdrop dims the real Data sources page. The right drawer is x 1160–1600 (440px), full height, `--surface` fill, 24px padding. Its header begins x 1185, y 24, width 391, with a 18px/24px weight 600 title and 12px subtitle. The scrolling body starts y 82; footer starts y 837, height 63, with Cancel and a white action pill. Fields have a 13px label, a 40px `--sunken` input with `--control` border and 6px radius, 12px helper text and 16px vertical field gap. Error border/text is `--negative`; valid text is `--positive`; warnings are `--warning`. Checkbox/radio tiles use `--accent-soft` when selected.

| State | Visible structure and exact content |
| --- | --- |
| `add-pick` | “Add exchange / Step 1 of 2 · Choose an exchange.” Two-column tiles in order Binance, OKX, Bitget selected, Kraken, Gate.io, Coinbase, Bybit, HTX, MEXC, Backpack; each says required key/secret/passphrase. Blue read-only banner, wallet-address tip, documentation link. Cancel / Continue with Bitget. |
| `add-form` | Back link Choose exchange. “Add Binance / Step 2 of 2 · API credentials.” Label optional (Binance), API key `vK3p9Qx2nT8mLw4Zr7YbH1c5uE6dFaG0jS7Qf2`, masked secret, public IP `203.0.113.42`, copy/refresh controls, read-only IP instructions and banner. Cancel / Save and test. Secrets stay masked. |
| `add-form-okx` | Same form for OKX, with a masked Passphrase field. |
| `add-form-errors` | OKX form with API key required, short secret, and missing passphrase; each field has a red border and inline explanation. |
| `add-form-saving` | Binance form dimmed and disabled; footer spinner “Checking the key with Binance…” and Saving… button. |
| `add-ip-loading` | Public IP block says “Looking it up…” and shows a skeleton. |
| `add-ip-error` | Red public IP block says “Couldn’t reach the lookup service. Check your connection.” plus Retry. No IP address shown. |
| `add-wallet-empty` | “Add wallet / Read a balance from a public address.” Three-column BTC selected, ETH Pro, SOL, DOGE, TRON Pro, TON, SUI tiles. Focused empty Address, optional Label, blue Public address only banner, disabled Add wallet. |
| `add-wallet-eth` | ETH selected; valid `0x4f2a8c1e9b07d3a5c6e41f8b2d90a7c3e5b1a91c`; green validation; amber ERC20 Pro quota banner; public-address banner; enabled Add wallet. |
| `add-wallet-invalid` | ETH selected; `0x4f2a8c1e9b07d3a5c6e41f8b2d90zz` and red “expected 0x followed by 40 hex characters”; Add wallet disabled. |
| `add-wallet-saving` | BTC selected; `bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq`, label Cold storage 2; “Reading the first balance…” spinner and Saving… disabled footer. |
| `add-broker` | Interactive Brokers explainer card; Flex Query ID `912406`, masked token, optional Label, Activity Flex Query instructions and documentation link, blue locally encrypted notice; Save and test. |
| `add-broker-error` | Invalid Query ID `912x04` and red numeric-only explanation; action disabled. |
| `add-broker-rejected` | Valid ID, rejected token with red expiration message; retry remains available. |
| `add-custom` | Symbol GOLD, name Gold bars, amount 4, segmented Manual / Follow a listed asset, USD price 2,650.00, value $10,600.00, Attach to a source dropdown set to Standalone, Add asset. |

The exchange/broker/wallet draft objects, custom asset amount/price/attachment, credential verification, public IP lookup, and Pro availability must remain the app's existing data and handlers. The reference uses a documentation-only public IP and fake API key/secret; tests must use fake credentials and the local e2e bridge. The modal should preserve keyboard focus, Escape, secret masking/reveal, loading, validation, success, and network error behaviour.

The current product validates a BTC address locally and closes its editor after a successful save; it does not read the first balance during the add flow. IBKR `verifyConfig()` checks only that the token and Query ID are nonempty, so it cannot produce the design's rejected-token state. Captures of those two requested states show the resulting real source list rather than an invented pending or rejected dialog.

## Remaining differences

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

The pixel ratios and screenshots for all fifteen states are recorded in the capture table below. Each ratio counts pixels whose maximum RGB channel error exceeds 24, divided by the full 1600px capture area.

`add-wallet-saving` cannot show “Reading the first balance…”: the existing add handler validates the BTC address locally, saves, and closes the drawer without requesting a balance. `add-broker-rejected` cannot show token rejection: the existing IBKR verifier checks only that the Flex Query ID and token are present, so the fake rejected token is accepted and the drawer closes. These captures show the real source list reached by those handlers. The ERC20 quota uses the e2e bridge's actual license result (12 of 300) rather than the design's invented 14 of 60. The reference IP `203.0.113.42` is reserved for documentation and is correctly rejected by the existing public-IP validator; the local bridge supplies `8.8.8.8` as the closest valid fixture address. The optional custom-asset unit “oz” is absent from the stored asset type. The source attachment picker omits broker attachment because the current custom asset attachment type supports only exchanges and wallets.

Exchange initials now match the source, the credential banner uses a blue shield treatment, external links show an icon, and the form close button shares the title row. The public IP remains `8.8.8.8` because the source's documentation-only address fails the product's validator. The ratios below include these corrections.

## Capture results

| State | Pixel difference | App capture |
| --- | ---: | --- |
| `add-pick` | 1.01% | `/tmp/fidelity-desktop/add-source/add-pick-desktop.png` |
| `add-form` | 1.74% | `/tmp/fidelity-desktop/add-source/add-form-desktop.png` |
| `add-form-errors` | 2.83% | `/tmp/fidelity-desktop/add-source/add-form-errors-desktop.png` |
| `add-form-okx` | 1.86% | `/tmp/fidelity-desktop/add-source/add-form-okx-desktop.png` |
| `add-form-saving` | 1.89% | `/tmp/fidelity-desktop/add-source/add-form-saving-desktop.png` |
| `add-ip-error` | 2.16% | `/tmp/fidelity-desktop/add-source/add-ip-error-desktop.png` |
| `add-ip-loading` | 1.66% | `/tmp/fidelity-desktop/add-source/add-ip-loading-desktop.png` |
| `add-wallet-empty` | 1.51% | `/tmp/fidelity-desktop/add-source/add-wallet-empty-desktop.png` |
| `add-wallet-eth` | 1.61% | `/tmp/fidelity-desktop/add-source/add-wallet-eth-desktop.png` |
| `add-wallet-invalid` | 1.99% | `/tmp/fidelity-desktop/add-source/add-wallet-invalid-desktop.png` |
| `add-wallet-saving` | 8.70% | `/tmp/fidelity-desktop/add-source/add-wallet-saving-desktop.png` |
| `add-broker` | 1.18% | `/tmp/fidelity-desktop/add-source/add-broker-desktop.png` |
| `add-broker-error` | 1.74% | `/tmp/fidelity-desktop/add-source/add-broker-error-desktop.png` |
| `add-broker-rejected` | 8.47% | `/tmp/fidelity-desktop/add-source/add-broker-rejected-desktop.png` |
| `add-custom` | 1.67% | `/tmp/fidelity-desktop/add-source/add-custom-desktop.png` |
