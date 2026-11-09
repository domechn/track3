# Assistant desktop fidelity

The shared rail geometry and active paint now follow [navigation.md](../navigation.md).

## Reference and measurements

Viewed all six supplied JPGs in `desktop/plan/`. They are 1440 × 900 except `assistant-thread-desktop.jpg` (1440 × 1500). The task's capture viewport is 1600 × 900; pixel comparisons must render the authoritative HTML at 1600 × 900, then compare same-sized app captures. Source pages: `ds/pages/plan-assistant.html`, `plan-assistant-new.html`, `plan-assistant-long.html`, `plan-assistant-approved.html`, `plan-assistant-error.html`, and `plan-assistant-nokey.html`. `ds.css`, `ds.js`, `plan-assistant.js`, `lib.js`, `ds/BRIEF.md`, and `core-navigation-map.html` determine the structure and values.

The following are Chromium `getBoundingClientRect` and `getComputedStyle` readings at 1600 × 900. All dimensions are CSS pixels.

| Block | Rectangle / computed style |
| --- | --- |
| Rail | x 0, width 56, full viewport; `--ground` #0d0d0e; 1px `--border` divider; icon items 36 high; active item #1c1c20 with 2px `--accent` marker. |
| Main | x 56, width 1544; padding 20px top, 28px sides, 40px bottom. |
| Heading | x 84, y 20; title 26px/32px weight 600 Public Sans, subtitle 13px/18px `--muted` at y 54; header 52 high, bottom gap 16. Heading actions: green status dot, 12px `--faint` model/time, 20px green Pro pill. |
| Chat grid | x 84, y 88, width 1488, height 772; columns 300px, remaining 860px, 296px with 16px gaps. Each pane has #131217 `--surface`, 1px #222224 border, 6px radius and subtle card shadow. No-key state uses one full-width pane. |
| Chat list | 300px wide; header 54px high, padding 16px 16px 10px; title 15px/20px 600; 28px pill New chat button; list horizontal padding 8px. Group captions 12px `--faint`, 10px top/4px bottom padding. Session row 58px, padding 10px 12px, 2px text gap, 6px radius. Selected row #1c1c20 and 2px blue left marker. Footer at pane bottom with lock icon, 12px/16px `--faint` copy and top hairline. |
| Thread | header 60px, horizontal padding 24px left/16px right; title 15px/20px 600; subline 12px/16px `--faint`; more icon button. Body padding 22px 28px with 20px vertical gap; body content max width 700px and centered. User bubble #23232a, border #222224, radius 12px 12px 4px 12px, padding 10px 14px. Assistant has a 28px blue spark avatar and a 12px gap to content. Markdown 13px/21px. |
| Table and chips | Tool chips 28px high, pill radius, 12px type, 8px gap. Answer table 660px wide; header 12px/16px, background #17161b, 8px 12px padding; rows 32px high; numeric columns right aligned with tabular figures. Gains `--positive` #5fc39c, losses `--negative` #ee6a82, unavailable dash `--faint` #9b9da3. |
| Approval card | 660px wide, 1px #2f4f7a border, #14161c fill, 8px radius, padding 16px 18px; 16px/22px 600 title; 31px key/value rows. Waiting uses `--pill-warn-bg` and `--warning`; approved uses `--pill-pos-bg` and `--positive` with surface fill and normal border. Approve is a white pill; Reject is an outlined pill. |
| Composer | Border-top section 153px high, padding 12px 24px 16px. Inner width 700px, centered. Four 30px outlined quick-action chips, 8px gaps; input 56px high, #0a0a0b `--sunken` fill, #3a3a3e border, 8px radius, padding 8px 8px 8px 14px. Circular send icon button. Keyboard tip 12px below; keycaps 11px. In no-key state composer is 85px without quick actions or tip, and input is disabled. |
| Context panel | Width 296px, padding 20px; title 15px/20px 600 and right-side 12px `--faint`. Four 57px rows with 34×20 pill switches. 1px separators. Usage key/value rows 30px high, right-aligned values. Tools and settings link at bottom. |

Page tokens come directly from `ds.css`: `--ground` #0d0d0e; `--surface` #131217; `--raised` #1b1a20; `--sunken` #0a0a0b; `--border` #222224; `--rule` #1b1a1f; `--control` #3a3a3e; `--hover` #18181c; `--text` #fff; `--muted` #b4b6bc; `--faint` #9b9da3; `--accent` #4a8ad6; `--positive` #5fc39c; `--negative` #ee6a82; `--warning` #d9a441. Buttons and segmented controls are pill-shaped; cards and inputs use 6px radii unless specified above. Body is Public Sans 13px/18px, weight 400, with tabular numbers. No gradients.

## Sections and state variants

### Shared shell

The left rail contains brand, Overview, four Analyze destinations, four Manage destinations, Settings at the bottom; Assistant is selected. The page title is **Assistant**. All configured states say “Ask about your holdings, P&L and allocation. Actions wait for your approval.” The top-right label is “gpt-4.1 · data as of 09:41” and a Pro pill. Context rows show, in order, “Holdings / 8 assets, $763,809.27” on, “Snapshots / 31 snapshots, 1 to 31 Oct” on, “Rebalance targets / 8 targets, total 100.0%” on, “Alert rules / 7 rules, 2 unread” off. “Usage this month / 1–31 Oct” has Requests 41, Tokens in 118,420, Tokens out 16,905, Estimated cost $0.47 and a note at $2.50 in / $10.00 out per 1M tokens. “Actions / Ask first” and “Daily insights / On” precede Tools: Look up holdings, Compare snapshots, Read rebalance targets are Allowed; Create or change alerts Asks first. The settings link is “AI assistant settings”.

The left list groups Today and Earlier. Today's first thread is “What drove my gain this week?” with “BTC added most in dollars, SOL in percent” and 09:42. Earlier entries, in order: “Rebalance plan, 30% BTC” / “Sell USDT, buy BTC to reach 30%…” / Yesterday; “Explain my 30D P&L” / “+$34,641.48 in 30 days, led by BTC” / 29 Oct; “Is my stablecoin share too high?” / “USDT and USDC are 29.1% of the total” / 27 Oct; “Compare 24 Oct with 31 Oct” / “Total rose by $26,010.84” / 24 Oct; “Alert ideas for SOL” / “A 7d move above 10% fits its recent range” / 22 Oct; “What changed since 1 Oct?” / “Total went from $729,167.79 to $763,809.27” / 20 Oct. Footer: “Chats are stored on this device and in encrypted sync.” New chat, session selection, the thread menu, context switches, quick prompts, composer, tool result actions, approval, copy, and settings navigation are interactive.

### `assistant-new-desktop.jpg`

The thread header says “New chat / Pro · gpt-4.1”. A centered 52px blue spark avatar precedes “Ask about your portfolio” and “Answers use your holdings and snapshots from the latest refresh. Anything that changes data asks for your approval first.” Below is a bordered Insights for today card. Its heading line says “Generated 09:41 · about 1,120 tokens” and has Refresh. Three 65px rows: “SOL is +14.3% in 7 days” with 9.0% weight and 8.0% target, action “Ask about SOL”; “BTC is 3.1 pts under target” with buying $23,405.22 funded by selling USDT, action “Plan a rebalance”; “95.5% of the way to $800,000” with $763,809.27 today, $36,190.73 to go and +$26,010.84 last 7 days, action “What would it take?”. Chat list is present with no selected row. The four quick prompts are Summarize this week, Biggest risks, Plan a rebalance, Explain 30D P&L. Insights loading/empty/error use the same card frame and real data or an inline status.

### `assistant-thread-desktop.jpg`

This is the full-height thread variant. It has the shared chat list and sticky context panel, then a thread header “What drove my gain this week? / 1 reply · $0.013 · gpt-4.1”. Content top to bottom: Today, user question “What drove my gain this week? And should I set an alert on BTC?” at 09:42; two successful tool chips; a prose answer with 7D +$26,010.84 (+3.53%) from $737,798.43 to $763,809.27; caption “Change in value by asset, 24 Oct to 31 Oct. Stables = USDT + USDC.” The four-column table is Asset / Value now / Price, 7D / Value change with rows BTC $205,737.58 +6.4% +$12,286.29; SOL $69,044.00 +14.3% +$8,663.30; ETH $151,251.35 +3.1% +$4,507.36; BNB $49,774.10 +2.7% +$1,324.26; NVDA $31,075.00 +1.7% +$532.40; Stables $222,446.74 unavailable price +$54.73; AAPL $34,480.50 −3.8% −$1,357.50; Total $763,809.27 +$26,010.84. Three bullets discuss SOL, BTC, AAPL in that order. Final paragraph gives BTC price $63,842.11 and 9.6% needed for $70,000. A waiting “Create alert: BTC above $70,000” approval card follows, then token/cost row and composer. The full-page HTML is 1406px high at 1600px viewport.

### `assistant-desktop.jpg`

The 900px viewport state uses the same thread but scrolls the thread body to its bottom. Visible top starts with the bottom of the table, then the bullets, final paragraph, full waiting approval card and usage footer. The composer is pinned at the bottom. The chat list and context panel fill the 772px chat grid height.

### `assistant-approved-desktop.jpg`

The body scrolls to the bottom. Header says “2 replies · $0.024 · gpt-4.1”. The card becomes a normal-border “Alert created” card with green “Approved 09:43” pill and “Open in Goals & alerts” link. Below it, a user bubble says “Yes, approve it.” at 09:43. An assistant tool chip says “Created alert / BTC above $70,000”; reply: “Done. The rule BTC price above $70,000 is on, with a 24 hour cooldown. It starts at 91.2% progress and is checked at each refresh.” A usage row shows gpt-4.1, 4,024 in, 58 out, about $0.011. The route link opens Goals & alerts; the approved card has no approval buttons.

### `assistant-error-desktop.jpg`

The newest Today row is selected: “Which positions are riskiest? / Request failed, message saved” at 09:51. Thread header says “Which positions are riskiest? / Request failed”. User question: “Which of my positions is the riskiest right now?” at 09:51. One successful tool chip reads “Looked up holdings / 8 assets”; the second is a red failed “Compared snapshots / failed”. A red inline banner says “Request failed”, “The model endpoint answered 429 (rate limit) after 3 tries. Your message is saved; last good reply was at 09:43.” Its actions are Retry and AI assistant settings; details read “HTTP 429, retry after 20 s”. The message and thread remain accessible for retry. Shared quick prompts and composer remain enabled.

### `assistant-nokey-desktop.jpg`

Only one full-width card appears. Subtitle: “Ask questions about your holdings in plain language.” Top-right amber pill: “Pro · key missing”. Inner card header: “Assistant / Pro · not configured”, more menu icon. Centered 52px key avatar, “Add an API key to use the assistant”, and “Track3 sends your questions and a summary of your portfolio to the model endpoint you choose. Nothing is sent until a key is set.” White pill “Open AI assistant settings” and a faint note “Settings, AI assistant: endpoint, API key, model and token prices.” The disabled composer at bottom says “Add an API key to start chatting” and shows a disabled send icon. No list, context, quick prompts, or keyboard tip.

## Data and product constraints

The reference values come from `lib.js`'s `T3` sample; the existing e2e `fidelity-scenes.ts` creates portfolio snapshots and holdings with the same $763,809.27 total and 31 October snapshots using real database rows. Sessions must use existing `chat_sessions` metadata and encrypted session files. Assistant messages and pending actions must use the existing chat and action shapes. The model can return text and markdown tables, but actual wording depends on its response. The approved alert may be created only through the existing confirmation flow.

The captures seed the existing AI configuration, `rebalance_profiles`, `alert_rules`, `chat_sessions`, encrypted session files, and the encrypted insight-card configuration. Monthly usage sums the actual stored assistant-message usage for October; unchanged sessions reuse cached usage. The context panel reads portfolio holdings through the shared rebalance loader, actual first and last snapshot dates, rebalance profile, and alert history. Holdings and estimated token cost use the selected base currency. The new-chat insight rows use existing cached mover, drift, and goal insight objects plus the shared rebalance portfolio. The fixture uses the existing assistant action and approved status shapes; live approval still goes through the existing confirmation flow. The capture uses the real dark-theme Tauri test bridge at 1600 × 900 and writes only to `/tmp/fidelity-desktop/assistant/`.

The session list keeps its empty message, loading skeleton, pin action, and delete confirmation dialog. Configuration loading keeps the existing loading card and configuration-error card; missing API key uses the specified full-width no-key state. A saved `[error]` reply uses the inline red banner with Retry and settings actions; retry resends the saved user question through the existing chat action. Insights loading, empty, and refresh errors continue to use the existing card state. Approval and errors remain in the saved chat; session and action dialogs are provided by the existing controls. No new toast is introduced by these six reference states.

## Remaining differences

**9 Nov 2026 layout audit:** assistant 9.715% at 1280 × 800, dark, against the rendered source HTML (RGB channel difference sum > 60). The dense CNY fixture and working product state differ from the static reference; the page-specific visible differences are listed below.

At 1100–1399 px the composer context hint uses 11 px text so its full holdings, snapshots and targets description fits beside the keyboard hint. The source uses 12 px in a wider thread pane.

The last recorded 8 Nov dense-data 1280 × 800 dark capture differs by **9.314%** from the rendered `plan-assistant-new.html` at RGB-sum threshold 60. The real-scale fixture has seven loadable encrypted conversations, matching the source's Chats density. A subsequent fixture update adds portfolio-derived insights and has not been recaptured under the one-run limit. The product retains its current CNY portfolio, test model, actual usage count and context choices. The source hard-codes an eight-asset USD portfolio, seven alerts, eight targets, model usage and sample insight text. These visible data differences remain because the fixture checks the product's stored values and encrypted session flow.

At 880–1119 px, the context pane opens as a drawer so the thread keeps its reading width. At 1120 px and above, it opens inline as the design shows.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

Rendered each authoritative HTML page at 1600 × 900, viewed it beside its app capture, then compared all pixels with a 24/255 maximum-channel threshold. Uncovered pixels in a shorter capture count as different. Ratios include text antialiasing and the intentional product differences below.

| State | Reference height | Capture | Differing pixels |
| --- | ---: | --- | ---: |
| New chat | 900 | `/tmp/fidelity-desktop/assistant/new.png` | 6.45% |
| Full thread | 1406 | `/tmp/fidelity-desktop/assistant/thread.png` (1329px high) | 12.19% |
| Waiting approval | 900 | `/tmp/fidelity-desktop/assistant/chat.png` | 7.41% |
| Approved action | 900 | `/tmp/fidelity-desktop/assistant/approved.png` | 6.79% |
| Saved request error | 900 | `/tmp/fidelity-desktop/assistant/error.png` | 7.21% |
| No API key | 900 | `/tmp/fidelity-desktop/assistant/nokey.png` | 1.64% |

Visible differences after side-by-side review:

The Actions value now uses the reference's white “Ask first” label, and the four context source rows have dividers. The section separators remain because they are present in the reference page. The ratios above include these corrections and the removal of the custom cooldown detail.

- **All configured states:** The four right-panel context switches are absent. Track3 currently has no per-question holdings/snapshots/targets/alert inclusion controls. Showing clickable or apparent switches without changing the model context would misstate what is sent. The data labels show the real context sources, and the existing model permissions, AI settings, and sync-status popover remain operative. This is also why the right-panel row text occupies more width than in the reference.
- **New chat:** The insight header says “Updated 09:41” instead of “Generated 09:41 · about 1,120 tokens.” The saved insight card has neither generation time nor model token usage; 09:41 is the latest snapshot time. The BTC rebalance hint is **$23,405.20** versus the design's **$23,405.22**: the app's existing rebalance calculation retains the two-cent rounding remainder as cash, while the design script adds it to BTC. The app shows its actual trade amount.
- **Full thread and waiting approval:** The two historical tool-result chips are absent. Assistant activity blocks can appear while a model runs, but the existing session loader retains only text and pending actions when it reloads a saved chat. The chips therefore cannot be recovered for these saved sessions. The custom cooldown detail is omitted because the format guard protects that persisted field and no owner exception was granted. The full thread is 77px shorter than the reference; the approval card and answer rise by the omitted rows and gaps.
- **Approved action:** The “Created alert / BTC above $70,000” historical activity chip is absent for the same session-loader reason. The green status pill says “Approved” without **09:43** because the action record stores proposal creation and expiration times, but no approval time. The confirmed rule and follow-up reply use the existing stored shapes.
- **Saved error:** The historical success/failure tool chips are absent for the same reason, so the error banner sits about 24px higher. The banner omits “after 3 tries” and “last good reply was at 09:43”: neither retry count nor last successful reply time is stored with a failed request. It displays the stored HTTP 429 detail and the actual saved-question retry action.

The table now colors currency losses, gives the caption its faint 12px treatment, and separates the bold Total row with a top rule. Remaining differences follow from the missing controls and saved activity chips listed above. The ratios above include these table corrections.
