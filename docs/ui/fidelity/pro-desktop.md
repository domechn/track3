# Pro & license desktop

Approved states: `pro`, `pro-free`, `pro-activating`, `pro-exhausted`, `pro-expired`, `pro-invalid`, `pro-deactivate`. The source is `ds/pages/settings-b-pro.html#<state>`. Shared measured shell, tokens, and control sizes are in [settings-b-shell-desktop.md](settings-b-shell-desktop.md).

## Structure and exact content

At x 320, y 110, the content uses seven and five grid columns (723.7px and 512.3px), then a 1252px full row. Grid gaps are 16px. Normal first-row cards are 329px high, second-row cards 320px, and the device card is 232px high. Exhausted and expired add a 66px warning banner before the cards.

1. **Track3 Pro**, seven columns: a Free, Active, or Expired status pill on the right. Three typographic KPIs labelled `Plan`, `Renews` or `Expired`, and `Devices`; the active values are `Pro yearly`, `14 Mar 2027`, `2 of 3`. KPI values are 20px/26px. The next sentence explains renewal, Free, or expiry. Hairline rows show `Billing`, `Member since`, `Current period` or `Last period`, with day-month-year dates. The final action is `Manage subscription`, `Subscribe` and `Compare plans`, or `Subscribe again`.
2. **What Pro includes**, five columns: four icon rows for `ERC20 wallet refreshes`, `TRON / TRC20 wallet refreshes`, `AI assistant on your own endpoint`, and `AI insights summary on Overview`. Each has a small second line (`300 a month`, `chat, tools, approval cards`, or `optional`). Check icons are green for active Pro; lock icons are grey for Free and Expired. Footer is the blue `track3.dev/#pro` external link.
3. **Usage this month**, seven columns: two 8px progress meters, each with a right-aligned `used of 300 · left` value, 0 and 300 endpoints, and a footnote. Active sample: ERC20 `143 of 300 · 157 left`; TRON `41 of 300 · 259 left`; `Resets 1 Nov 2026, 00:00 UTC`. Exhausted shows a full pink ERC20 bar and `300 of 300 · limit reached`; expired freezes the bars grey; Free labels both `Not included in Free`.
4. **License key**, five columns: a masked input or a focused editable key input with a measured 22px/28px, weight 500 value, an eye/check icon, and `Verify` or `Activating…` button. Valid shows `T3P-••••-••••-••••-Q7M4`, a green validation sentence, and rows `Activated 14 Mar 2026`, `Last verified Today, 09:41`, `Device slots 2 of 3 used`. Free uses the `T3P-XXXX-XXXX-XXXX-XXXX` placeholder. Invalid shows `T3P-8F2K-N4VD-6WXA-Q7M5` with a pink border and `Key not recognised. Check for typos.` Activating uses the Q7M4 key, blue focus border, spinner, and disabled button.
5. **Devices on this license**, full width: tabular header `Device / System / Activated / Last seen`, two rows in this order: `Dom’s MacBook Pro / This device / macOS 15 · Track3 0.9.4 / 14 Mar 2026 / Active now`, then `Home PC / Windows 11 · Track3 0.9.4 / 2 Apr 2026 / 28 Oct 2026, 21:14`. Each starts with a laptop icon and ends in an outlined deactivation pill. Free instead shows a dashed empty notice, `No devices on a license yet`.

`pro-deactivate` overlays a 560px centred confirmation: `Deactivate this device?`, three consequences in a bullet list, `Cancel`, and a pink `Deactivate this device`. The scrim dims the whole shell. Buttons, links, key visibility, verification, device deactivation, checkout, and the dialog must remain keyboard accessible.

## Remaining differences

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

An expired or legacy key still offers local deactivation. The expired state now shows both device rows, its dated expiry messages, and the current device's active status. If the device API fails, the card shows a local deactivation fallback; the reference has a complete device list.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

All seven source renders and captures were viewed side by side. Screenshots: `/tmp/fidelity-desktop/pro/<state>-desktop.png` (`pro-desktop.png` for the default). Full-page 1600px pixel ratios at a 24/255 maximum-channel threshold:

| State | Differing pixels |
| --- | ---: |
| pro | 2.40% |
| pro-free | 3.11% |
| pro-activating | 3.19% |
| pro-exhausted | 4.26% |
| pro-expired | 4.26% |
| pro-invalid | 3.24% |
| pro-deactivate | 3.51% |

- **All states with a license:** The fixture supplies the approved plan date, 143/41 usage, reset date, device platforms and activation dates through the existing subscription and device response shapes. The app does not receive friendly device names, current operating-system versions, or a “last verified” timestamp from its license API. It therefore shows `macOS` and `Windows`, the stored app versions, and a dash for verification time. The source names `Dom’s MacBook Pro` and `Home PC`, shows macOS 15/Windows 11, and claims a verification at 09:41. The last-seen row uses the API date without the source's “Active now” inference.
- **Device actions:** The API supports deactivation only for the current device. The second device displays “Managed on that device” instead of a Deactivate button. A remote action would have no working backend and would mislead users. The current-device confirmation still uses the real deactivation flow and now has the source's three-bullet explanation, width and button treatment.
- **Default:** The usage period end now supplies the one-day reset countdown, and the key status uses the current device's activation date. When either field is absent, the UI falls back to the available license state and period date.
- **Free, activating, invalid:** The free and pending states follow the actual license activation flow. The invalid-key result displays the actual activation error; the source uses a fixed “Key not recognised. Check for typos.” line. No license is written in the invalid state.
- **Exhausted and expired:** The 300/300 usage and expired period are valid fixture API responses. The source gives a source-specific wallet address in the warning and a “TRON still works” sentence, neither of which the license response supplies. The app uses its generic quota/expiry text and keeps its actual wallet refresh handling. The expired license keeps the masked key and frozen grey meter.

The current-device deactivation dialog now derives the remaining active device count. The remaining differences follow from unavailable device names, OS versions, verification time, and wallet-specific warning data. The ratios above include the countdown, key status, dialog count, and wide Settings corrections.
