---
name: investment-report
description: Use when the user asks to generate an investment report, portfolio recap, annual investing summary, report page, or an HTML investment report, including Chinese requests like "帮我生成 2025 年到 2026 年的投资报告", "生成投资报告", "做一个投资复盘报告", or "输出投资报告 HTML". Collect privacy preferences before generating, such as whether exact amounts, allocations, or ticker names should be visible.
---

# Investment Report

Use this skill when the user wants an investing report page that can later be screenshotted, exported, or opened in a browser.

This skill creates a self-contained HTML report with dynamic rendering from a JSON payload.

## Default Workflow

1. Confirm the report scope.
   - Ask for the period if it is missing.
   - Clarify whether the report is for a portfolio, one account, or one strategy.
2. Collect privacy preferences before generating anything.
   - Prefer `vscode_askQuestions` when available.
   - Ask at least:
     - whether exact money values can be shown
     - whether allocation amounts can be shown
     - whether ticker or asset names can be shown
   - which currency and language the report should use
3. Gather the content.
   - If the user already provides summary data, use it directly.
   - If the data should come from local Track3 history, first query the relevant data with the Track3 history skill or CLI, then convert it into a compact share-safe payload.
4. Write a JSON payload and generate the HTML.

```bash
node .agents/skills/investment-report/bin/generate-investment-report.mjs \
  --input <report.json> \
  --output <report.html>
```

5. Return the HTML path and summarize which sensitive fields were hidden.

## Intake Checklist

Collect these fields before running the generator:

- `title`: report title
- `subtitle`: optional one-line summary
- `period.from` and `period.to`
- `currency`: for example `USD` or `CNY`
- `language`: `zh-CN` or `en-US`
- `privacy.showAmounts`: `true` or `false`
- `privacy.showAllocationAmounts`: `true` or `false`
- `privacy.showTickers`: `true` or `false`
- `summary.startingValue`
- `summary.endingValue`
- `summary.netContribution`
- `summary.netProfit`
- `summary.totalReturnPct`
- `summary.annualizedReturnPct`: optional
- `summary.maxDrawdownPct`: optional
- `allocation[]`: optional top positions for the chart section
- `highlights[]`: optional highlight cards
- `narrative.headline`
- `narrative.bullets[]`

## Privacy Rules

- If `privacy.showAmounts` is `false`, do not embed raw summary amounts in the HTML.
- If `privacy.showAllocationAmounts` is `false`, do not embed raw allocation amounts in the HTML.
- If `privacy.showTickers` is `false`, replace asset names with generic labels like `Asset 1`, `Asset 2`, and so on.
- Percentages are usually safe to keep, but still confirm if the user is sensitive about them.

## Suggested Ask Tool Prompt

Use one concise question batch. A good default is:

- report period
- report language
- show exact amounts or mask them
- show allocation amounts or mask them
- show asset names or anonymize them
- output filename or default slug

## Example Input

See the sample payload:

`/.agents/skills/investment-report/examples/investment-report.sample.json`

## Example Command

```bash
node .agents/skills/investment-report/bin/generate-investment-report.mjs \
  --input .agents/skills/investment-report/examples/investment-report.sample.json
```

The generator defaults the output path to:

`/.agents/skills/investment-report/output/<slug>.html`

## Expected Response Shape

When using this skill, respond with:

- the report period and language
- which privacy settings were applied
- the generated HTML path
- whether the page contains raw amounts or only masked share-safe values
