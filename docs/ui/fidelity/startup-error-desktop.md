# startup-error desktop design specification

Approved image: `desktop/flows/startup-error-desktop.jpg`. Authoritative source: `source/ds/pages/flows-startup.html#error`, `flows.css`, `ds.css`, `ds.js`, and `lib.js`. Image and source render inspected at 1600 px in dark theme.

## Structure and measured geometry

Full-page size: **1600 × 900 px**. This is a full-screen error view with no app rail or dashboard grid. A 560 px content column starts at x=520 and is vertically centered. From top to bottom it has a warning glyph, 26/32 px heading, 13/19 px explanation, a bordered error-details panel with monospaced traceback, 34 px Copy details and Reload pills separated by 10 px, and a 12/18 px reporting hint.

| Block or component | Bounds | Opening copy |
| --- | --- | --- |
| `div.mid` | (0, 0) 1600 × 900 px | Something went wrong Track3 hit an unexpected error and stopped this screen. Your data is stored separately and is not affected. E |
| `div` | (520, 241.5) 560 × 389 px | Something went wrong Track3 hit an unexpected error and stopped this screen. Your data is stored separately and is not affected. E |

## Exact visible copy, order, type and colour

The source uses Public Sans; the traceback is monospaced. Tokens: ground `#0d0d0e`, card `#131217`, raised `#1b1a20`, border `#222224`, rule `#1b1a1f`, control `#3a3a3e`, text `#fff`, muted `#b4b6bc`, faint `#9b9da3`, accent `#4a8ad6`, positive `#5fc39c`, negative `#ee6a82`, warning `#d9a441`. The sample traceback includes a version, schema, platform and UTC timestamp; those must be actual diagnostic values in a real error.

| Copy | Bounds | Font (size/line height weight) | Computed colour |
| --- | --- | --- | --- |
| Something went wrong | (520, 290.5) 560 × 32 px | 26px/32px 600 | `rgb(255, 255, 255)` |
| Track3 hit an unexpected error and stopped this screen. Your data is stored separately and is not affected. | (520, 328.5) 560 × 38 px | 13px/19px 400 | `rgb(180, 182, 188)` |
| Error details (sample) | (535, 397.5) 530 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| TypeError: Cannot read properties of undefined (reading 'value') at HoldingsTable (renderer.js:2841:17) at Overview (renderer.js:1203:9) Track3 2.3.1 · schema 14 · darwin-arm64 31 Oct 2026 09:44:12 UTC | (535, 421.5) 530 × 108 px | 12px/18px 400 | `rgb(180, 182, 188)` |
| Copy details | (520, 562.5) 127 × 34 px | 13px/18px 500 | `rgb(255, 255, 255)` |
| Reload | (657, 562.5) 94 × 34 px | 13px/18px 500 | `rgb(13, 13, 14)` |
| If it happens again after reloading, copy the details and include them when you report it. | (520, 612.5) 560 × 18 px | 12px/18px 400 | `rgb(180, 182, 188)` |

## Interactive parts and state variants

This specification covers the **startup-error** state. The warning and traceback are the error state; the two buttons are its recovery controls:

- button: `Copy details` at (520, 562.5) 127 × 34 px.
- button: `Reload` at (657, 562.5) 94 × 34 px.

Copy details copies the diagnostic text, and Reload restarts the app screen. Focus order follows these buttons. There is no dashboard, loading skeleton, popover or toast in this reference state.

## Remaining differences

- Measured pixel difference: **3.03%** using the review gate's RGB-difference sum greater than 60. Source 1600 × 900; app 1600 × 900. [App capture](/tmp/fidelity-desktop/startup/startup-error-desktop.png); [rendered design](/tmp/fidelity-desktop/design-flows/startup-error.png). The ratio uses the overlapping top-left rectangle; the dimensions show any size mismatch.
- A render failure in the desktop route opens the full-screen error boundary with a safe error preview, Copy details and Reload. The runtime error and stack details differ from the source's fixed example; the icon glyph and a few text baselines also differ. Native errors before the WebView and React tree mount remain unverified.
