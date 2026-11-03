# Appearance desktop fidelity

See [Settings A shell](settings-a-shell-desktop.md). Viewed `appearance-default`, `appearance-redup`, and `appearance-system` JPGs and read `ds/pages/settings-a-appearance.html`. At 1600px the HTML source measures a 724×400px Theme card and a 512×400px Gain and loss colours card at x 320, y 110, with a 16px gap, 20px padding and 6px radius. Heading “Appearance / Theme and the colours used for gains and losses.” Section titles are 15px/20px weight 600.

Theme card top row says “Theme” and right-aligned “Applies instantly”. Three preview tiles are each 219×240px with a 12px gap, 12px padding, `--sunken` fill and 1px border. Previews are a small light, dark, and split-system app with the same $763,809.27 total and blue mini chart. Labels below are Light / Bright surfaces, Dark / Terminal, true neutral, System / Follows your device. Selected tile has a blue border, blue-soft fill, and blue selected radio. Below them, an info icon precedes “Design note: every screen in this set is drawn in the dark theme. The light and system previews above only show the choice.”

Right card title “Gain and loss colours”, description “Pick which colour means up. Gains and losses everywhere follow it.” Two stacked selectable tiles: “Green up, red down / Common in Europe and the US” and “Red up, green down / Common in China, Japan and Korea”. Each has BTC today +2.14% / +$1,320.40 and AAPL today −1.07% / −$265.10 example cells. The selected first option uses `--positive` #5fc39c for BTC and `--negative` #ee6a82 for AAPL; the second reverses the two colors. `appearance-default` has Dark and green-up selected. `appearance-redup` selects the second colour convention and keeps Dark. `appearance-system` selects System and green-up, but the design screenshot itself remains dark. Theme and quote-color selections use the existing app preferences and retain keyboard radio behaviour and live quote colors.

## Remaining differences

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

The capture table records current ratios at a 24/255 maximum RGB channel threshold. The miniature previews use available persisted snapshots rather than the source's drawn samples.

## Capture results

| State | Pixel difference | App capture |
| --- | ---: | --- |
| `appearance-default` | 2.75% | `/tmp/fidelity-desktop/appearance/appearance-default-desktop.png` |
| `appearance-redup` | 2.75% | `/tmp/fidelity-desktop/appearance/appearance-redup-desktop.png` |
| `appearance-system` | 2.75% | `/tmp/fidelity-desktop/appearance/appearance-system-desktop.png` |
