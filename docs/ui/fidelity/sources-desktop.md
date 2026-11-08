# Data sources desktop fidelity

See [Settings A shell](settings-a-shell-desktop.md) for shared geometry, type, tokens, and navigation. Viewed all ten `sources-*-desktop.jpg` references and read `ds/pages/settings-a-sources.html` plus `settings-a.js`. The source card is x 320, y 160, width 1252. Default exchanges card ends y 437; the info banner begins y 453 and is 62px high.

## Structure and sample data

Heading: **Data sources**; subtitle “Everything Track3 reads: **3 exchanges**, **2 wallets**, **1 broker** and 2 custom assets.” The white Add button changes to Add exchange, Add wallet, Add broker, or Add custom asset with the active tab. Tabs are Exchanges 3, Wallets 2, Brokers 1, Custom assets 2. Each row has a 28px letter logo; bold name, 12px metadata; Active green, Paused gray, or Error red pill; last refresh; right-aligned USD value or em dash; blue/gray switch; and Quick look, rename, remove actions. The name opens the existing editor. Count and total sit in the table footer. Quick look and attach are modal dialogs, remove is a destructive confirmation. The status note is a full-width blue information banner below the table.

| State | Exact visible content and order |
| --- | --- |
| `sources-default` | Header Source / Status / Last refresh / Value / Active. Binance, API key ending 7Qf2, Active, Today 09:41, $358,418.17; OKX, c91e, Active, Today 09:41, $142,475.77; Kraken, 3Ld0, Paused, 12 Oct, 18:05, em dash. Footer “2 active, 1 paused” and $500,893.94. Banner “Read-only access / Read-only API keys are enough: Track3 never trades or withdraws. Keys stay encrypted on this device.” |
| `sources-wallets` | Ledger cold wallet / Bitcoin · bc1q…x7k2 / Today 09:40 / $129,127.05; 0x4f…a91c / Ethereum · ERC20 tokens · Pro / Today 09:40 / $68,232.78. Both active; footer $197,359.83. Banner states public addresses only and ERC20/TRON Pro quota 14 of 60 this month. |
| `sources-brokers` | Interactive Brokers / Flex Query · ID 912…406 / Today 09:41 / $65,555.50, active; footer 1 active and $65,555.50. Banner describes its read-only Flex Query. |
| `sources-custom` | Asset / Price / Attached to / Value / Active header. GOLD / Gold bars · 4 oz / Manual · $2,650.00 / Standalone / $10,600.00; NVDA-RSU / Unvested shares · 60 / Follows NVDA · $141.25 / Interactive Brokers / $8,475.00. Footer 2 custom assets, $19,075.00. Blue banner says the reference custom assets are sample placeholders and outside the $763,809.27 total. The real app must show actual custom assets and their true inclusion in totals. |
| `sources-empty` | Exchanges count 0; no table header. Dashed empty panel “No exchanges yet / Add one to start reading balances. Nothing leaves this device.” with white Add exchange button. Read-only banner remains. |
| `sources-loading` | Header remains; three rows and footer are dark skeleton blocks, with the info banner below. |
| `sources-error` | OKX is Error, “Last good 08:12,” $142,475.77 marked stale, and a red inline row with allowlist explanation plus Retry. Footer retains $500,893.94 and notes OKX value as of today 08:12. |
| `sources-quicklook` | Scrim; centered 560px dialog titled Binance, “Quick look · refreshed today 09:41,” five holdings in descending value: USDT 112,446.74/$1.00/$112,446.74; BTC 1.2/$63,842.11/$76,610.53; SOL 410/$168.40/$69,044.00; ETH 20/$2,527.14/$50,542.80; BNB 85.8796/$579.58/$49,774.10. Total $358,418.17; Pro quota note; Close and Refresh Binance buttons. |
| `sources-attach` | Scrim; centered Attach GOLD to a source dialog. Explanation, then radio rows Standalone selected; Binance; OKX; Kraken paused; Ledger cold wallet; 0x4f…a91c; Interactive Brokers. Footer Cancel and Attach. |
| `sources-remove` | Scrim; centered “Remove OKX?” confirmation describing deletion of the API key and secret. Cancel and red outlined Remove OKX buttons. |

Source names, aliases, wallet addresses, broker IDs, prices, source inclusion, enabled switches, and quick-look holdings come from existing configuration and database fields. Last-success and stale status come from the existing `track3-refresh-source-statuses` record; the normalizer retains only safe error categories and fixed details, so the original allowlist wording cannot be reconstructed. The existing `OtherAttachment` format permits CEX or wallet attachments, but not broker attachments, so NVDA-RSU cannot actually attach to Interactive Brokers without a forbidden format change. Empty/loading/error states retain real connection behaviour. All add, edit, toggle, attach, quick look, retry, and remove actions keep the existing handlers and confirmation.

## Remaining differences

The approved source is dark only. The live page honors the selected light theme, so its light colours cannot match that reference.

The approved static page uses its pencil for the full source editor and has no Rename flow. The live page uses that pencil for the requested Rename dialog; the visible source name opens the full editor. Both actions remain keyboard reachable.

Existing custom asset aliases may be 41–100 characters long. The new Rename dialog enforces the requested 40-character limit, so opening one of those older aliases shows a length error until it is shortened; the original custom asset table still accepts up to 100 characters.

The visible source name opens the existing configuration editor. The iPhone avatar also offers its action menu.

The new alias screenshots use actual source data, so their text and values differ from the fixed design fixture. The capture table below is the earlier matched-fixture baseline.

UI42 uses the approved website-style neutral tile for exchange, wallet, broker and custom marks. The older Sources page design renders those marks differently.

The wide empty Sources card keeps the design's 188px outer height; its dashed inner state has a 146px minimum. This is shorter than the shared component's 200px default because the approved source page uses the compact card.

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

The pixel ratios and screenshots for all ten states are recorded in the capture table below. Each ratio counts pixels whose maximum RGB channel error exceeds 24, divided by the full 1600px capture area.

The source design gives ERC20 refresh usage as 14 of 60. The e2e bridge's real license response provides 12 of 300, and the UI displays that actual entitlement. The reference attaches NVDA-RSU to Interactive Brokers; the current `OtherAttachment` data type allows exchange and wallet identities only, so the broker option is disabled. The reference labels GOLD as “4 oz,” but the custom asset record stores an amount without a unit. The custom asset banner explains actual portfolio inclusion because the source design's statement that these are excluded placeholders contradicts product behaviour. The exact long allowlist error sentence in `sources-error` is unavailable after the existing source-status normalizer keeps only its safe error category and detail. Blacklist and source controls remain bound to real configuration values.

The `sources-loading` fixture now delays the source query after the initial portfolio load, so the capture shows three table skeleton rows and the footer without the global portfolio overlay. The ratios below include this correction.

The current matched-fixture capture at 1600 × 900 CSS pixels, dark theme, RGB threshold 24 gives **2.459% Exchanges**, **2.519% Wallets**, **2.204% Brokers**, and **2.537% Custom**. The first row's bounds match the design exactly at x=321, y=197, 1250×64. The measured geometry and images are in `/tmp/track3-source-rename/desktop-dark-measure.json` and `/tmp/track3-source-rename/desktop-dark-{design,sample}-<state>.png`. The light app against the dark-only source differs by 99.886%, 99.886%, 99.895%, and 99.890%, respectively; these light ratios reflect the selected product theme.

## Capture results

| State | Pixel difference | App capture |
| --- | ---: | --- |
| `sources-default` | 2.74% | `/tmp/fidelity-desktop/sources/sources-default-desktop.png` |
| `sources-wallets` | 2.76% | `/tmp/fidelity-desktop/sources/sources-wallets-desktop.png` |
| `sources-brokers` | 2.45% | `/tmp/fidelity-desktop/sources/sources-brokers-desktop.png` |
| `sources-custom` | 2.83% | `/tmp/fidelity-desktop/sources/sources-custom-desktop.png` |
| `sources-empty` | 1.67% | `/tmp/fidelity-desktop/sources/sources-empty-desktop.png` |
| `sources-loading` | 3.13% | `/tmp/fidelity-desktop/sources/sources-loading-desktop.png` |
| `sources-error` | 4.67% | `/tmp/fidelity-desktop/sources/sources-error-desktop.png` |
| `sources-quicklook` | 3.01% | `/tmp/fidelity-desktop/sources/sources-quicklook-desktop.png` |
| `sources-attach` | 1.44% | `/tmp/fidelity-desktop/sources/sources-attach-desktop.png` |
| `sources-remove` | 1.90% | `/tmp/fidelity-desktop/sources/sources-remove-desktop.png` |
