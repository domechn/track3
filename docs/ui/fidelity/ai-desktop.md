# AI assistant settings desktop

Approved states: `ai`, `ai-testing`, `ai-fail`, `ai-reveal`, `ai-saved`, `ai-json-error`. Source: `ds/pages/settings-b-ai.html#<state>`. Shared measured shell and tokens: [settings-b-shell-desktop.md](settings-b-shell-desktop.md).

## Structure and exact content

The title is `AI assistant`; subtitle: `Connect an OpenAI-compatible endpoint and control what the assistant may do.` At x 320/y 110 the first row is 723.7px + 16px + 512.3px, both cards 419px high. `Behaviour` spans 1252px at y 545 for 132px. `Advanced options` spans 1252px at y 693 for 338px, or 354px with invalid JSON. The source `.input.mono` wrapper computes to 12px, while its `.v` value span computes to **22px/28px Public Sans, weight 500**; editable app fields use that effective value style.

1. **Connection** card: status pill `Connected`, `Testing`, or `Failed`. The OpenAI-compatible endpoint field shows `https://openrouter.ai/api/v1`, with `Track3 appends /chat/completions.` below. The API key is masked as `sk-or-v1-••••••••••••••••••••••••5d51c` and has an eye button. A note says the key is encrypted on the device and excluded from exports. Model select shows `anthropic/claude-sonnet-4.5`. Footer has a `Test connection` pill and inline status. Default green status says `Connected in 412 ms. anthropic/claude-sonnet-4.5 replied. Tested 09:42, 38 tokens used.` Testing shows a spinner and `Sending a short test message to openrouter.ai…`. Failure is pink and begins `401 Unauthorized.`
2. **Context and cost** card: select `128,000 tokens`; a note explains old messages are dropped. `Input price $3.00 / 1M` and `Output price $15.00 / 1M` are paired inputs. The monthly usage rows show `Input tokens 1,284,300 · $3.85`, `Output tokens 212,600 · $3.19`, and bold `Estimated cost $7.04`. Currency uses a leading dollar and two decimals; counts use commas.
3. **Behaviour** card: two columns of labelled toggles, `Allow assistant actions` and `Proactive insight summary`, both on in the sample. Each has a two-line explanatory sentence. Toggles are 34px by 20px, blue when on.
4. **Advanced options** card: title, description, `Reset` and `Format` buttons; a two-column split of a dark 10-line monospace JSON editor and a five-row parsed-options list. Syntax colours are blue keys, green strings, amber numbers, pink booleans. Options appear in order `temperature`, `top_p`, `headers`, `extra_body`, `provider`. The valid footer reads `Valid JSON. 5 options applied to the next request.` Invalid state marks line 9 in pink, disables Format, and explains the trailing comma and that the last valid settings remain in use.

`ai-reveal` displays the full API key in the focused input. `ai-saved` has a bottom-right success toast `Settings saved / Assistant options applied.` The controls must keep encryption, validation, test call, save, reveal, formatting, and accessible focus behaviour.

## Remaining differences

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

All six source renders and captures were viewed side by side at 1600px. The screenshots are `/tmp/fidelity-desktop/ai/<state>-desktop.png`; the unqualified state is `ai-desktop.png`. A 24/255 maximum-channel pixel threshold over the full page gives:

| State | Differing pixels |
| --- | ---: |
| ai | 3.02% |
| ai-testing | 3.02% |
| ai-fail | 3.10% |
| ai-reveal | 3.28% |
| ai-saved | 3.16% |
| ai-json-error | 3.05% |

- **Every state:** The model and context size keep editable controls, styled with the design's select chevrons and formatted values. Arbitrary OpenAI-compatible model IDs and context limits are valid existing settings, so fixed options would block valid configurations. The Advanced editor displays `extraBody` and a single provider ID because those are the supported configuration properties; the design's `extra_body` and provider-order object are unsupported stored shapes. The unsupported values are not shown as if they would affect requests. The editor uses the closest valid JSON sample, whose supported `extraBody` object wraps beyond the design's tenth visible line.
- **Default, reveal, saved:** The test result says that the connection succeeded, without “412 ms”, “38 tokens used”, or “Tested 09:42”. The current probe API returns only success or failure and does not persist those diagnostics. The monthly usage counts and $7.04 cost now come from a saved assistant message with the exact sample token usage, and keep the source order and number formatting.
- **Masked key:** The source's masked key ends in `5d51c`, while its revealed sample key ends in `3d51c`. The app derives the masked suffix from the stored key and therefore shows `3d51c` in the default state. A different suffix would misidentify the key being tested.
- **Testing and failure:** The progress and 401 failure follow a real probe request through the fake HTTP bridge. The source's provider-specific long error sentence and clock/token fields are absent because the current probe returns a generic HTTP status/error. A source-style statement about an actual model reply would misreport the result.
- **Saved:** Track3 requires an explicit Save after editing settings; the approved HTML has only Reset and Format. The extra white Save button remains in the Advanced card to preserve the existing encrypted write flow. The success toast now uses the approved wording.
- **Invalid JSON:** The draft now matches the design's ten lines and highlights line 9. The editor detects the visible trailing comma, reports its line and column, and retains the last valid option summary without saving the draft.

The cards, grid, row order, colours, typography and JSON token colours follow the measured source CSS. Remaining differences follow from the supported model settings, probe result, and save flow described above. The percentages above include the wide Settings strip correction.
