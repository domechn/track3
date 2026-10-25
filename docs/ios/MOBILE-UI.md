# Mobile UI contract

`src/mobile/components/mobile/index.tsx` exports the shared phone components. Use these
inside the existing `HashRouter` routes; each screen keeps its middlelayer
queries and mutations.

- `MobilePage({ title, back?, actions?, children })` provides a large title and
  optional 44pt back action. The shell owns the tab bar, compact total header,
  and safe areas, so pages should not add their own viewport padding.
- `BottomSheet({ open, onOpenChange, title, detents?, initialDetent?, children })`
  uses Radix's focus trap and Escape/backdrop dismissal. The handle switches
  between `medium` and `large` detents by dragging. Use it for details and
  forms. Put long content inside the sheet body; it scrolls.
- `ActionSheet({ open, onOpenChange, title, actions })` displays labeled
  actions and Cancel. Each action has `{ label, onClick, destructive?,
  disabled? }`.
- `SwipeableRow({ actions, children })` reveals trailing buttons after a
  left swipe. Actions enter keyboard navigation when revealed. Wrap the
  visible row content in a button when it opens a detail.
- `SegmentedControl({ options, value, onChange, label? })` is a labeled radio
  group for short range choices.
- `PullToRefresh({ onRefresh, disabled?, lastRefreshText?, children })` calls refresh after a
  downward gesture that begins at the top. Return the refresh promise from
  `onRefresh` so its progress indicator stays visible until the refresh ends.
  `lastRefreshText` appears in the indicator while pulling or refreshing.
  The app shell invokes the existing refresh flow through context.
- `InsetGroup({ title?, children })` and `ListRow({ value?, href?, onClick?,
  trailing?, children })` provide grouped lists with 44pt or larger rows.
- `MobileRecordList({ records })` renders records as grouped rows. Each record
  has `{ id, title, subtitle?, fields, actions? }`; tapping a row opens a
  field list in a sheet. Use it for wide tables on phones.
- `useHaptics()` returns a function taking `selection`, `light`, or `success`.
  It calls the native haptic bridge on iOS, uses vibration on other supported
  devices, and respects reduced motion.
- `useIsMobile()` detects a coarse pointer at 950px or narrower, including an
  iPhone in landscape. Use it when
  a phone sheet replaces a Radix popover or dialog, so only one overlay is
  mounted at a time.

Mobile styles use existing semantic color variables and `rem` sizing. Keep
wide tables on desktop only; present individual records as rows and detail
sheets on phones. All new labels must be added to both locale catalogs.
The shell recognizes an edge swipe from the left in the main content using
touch pointer events. Its `pan-y` touch action keeps vertical scrolling
available while allowing the back gesture to complete.

The source and alert editors use `ModalPage` from
`src/mobile/components/mobile/overlays.tsx` for a full-screen focus trap.
`ConfirmSheet` in that file is an `alertdialog`. Grouped Settings links use
the shared `InsetGroup` and `ListRow` above.
