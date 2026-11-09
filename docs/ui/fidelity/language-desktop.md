# Language desktop fidelity

See [Settings A shell](settings-a-shell-desktop.md). Viewed `language-default`, `language-zh`, and `language-zh-toast` JPGs and read `ds/pages/settings-a-language.html`. Heading is “Language / Choose the language of the app.” in English or “语言 / 选择应用界面的显示语言。” in Chinese. The main two cards begin x 320, y 110, are 618px wide each, and are 273px high with 16px gap. Cards have 1px `--border`, 6px radius, and `--surface` fill.

Left card begins with “App language / Menus, labels and messages. Your data is not changed.” in 20px padding. Two 72px option rows have a 28px square EN/中 icon, bold language title, a 12px subtitle, and a 16px radio on the right. Rows are English / English then 简体中文 / Simplified Chinese. Active row has `--accent-soft` fill and selected radio. Footer “Takes effect immediately.” is 14px padded with a top divider. Right card is “Preview” with the selected language at right, four 42px rows of Overview/总览, History/历史, Total value/总价值, Today/今天; left column is current language and right is the other. Footer “Left column is the current language.” Chinese uses the corresponding supplied copy and side menu translations. Locale changes through the existing `I18nProvider` and browser locale key, without changing any other stored format.

`language-default` selects English, `language-zh` selects 简体中文 and swaps the preview columns, and `language-zh-toast` adds a bottom-right success toast in a 1600×1222px capture: “语言已切换 / 已切换到简体中文.” The toast uses a green leading border and the standard toast dock. All row labels and toast descriptions must be translated by new keys.

## Remaining differences

**9 Nov 2026 layout audit:** language 4.495% at 1280 × 800, dark, against the rendered source HTML (RGB channel difference sum > 60). The dense CNY fixture and working product state differ from the static reference; the page-specific visible differences are listed below.

At 1100px the app shows its editable summary and language controls in one column. The static source shows App language and Preview side by side; stacking the live summary cards keeps the Language card within the 60px empty-space limit.

The live Refresh and date-range controls remain visible in wide Settings; the static reference omits them. This keeps both actions available while viewing Settings.

Settings toasts retain a visible 44px close × target for keyboard and pointer dismissal; the reference toasts omit it.

The Goals unread dot follows actual alert state; its size and placement differ slightly from the source rail.

Small font, icon, spacing, and colour rendering differences could be matched but are not worth another round.

The capture table records current ratios at a 24/255 maximum RGB channel threshold. The Chinese toast capture contains the full toast.

## Capture results

| State | Pixel difference | App capture |
| --- | ---: | --- |
| `language-default` | 1.63% | `/tmp/fidelity-desktop/language/language-default-desktop.png` |
| `language-zh` | 1.22% | `/tmp/fidelity-desktop/language/language-zh-desktop.png` |
| `language-zh-toast` | 0.98% | `/tmp/fidelity-desktop/language/language-zh-toast-desktop.png` |
