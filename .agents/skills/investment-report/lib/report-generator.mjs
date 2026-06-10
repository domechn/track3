import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const MASK = "******";
const DEFAULT_OUTPUT_DIR = ".agents/skills/investment-report/output";

const COPY = {
  "en-US": {
    period: "Period",
    startingValue: "Starting value",
    endingValue: "Ending value",
    netContribution: "Net contribution",
    netProfit: "Net profit",
    totalReturnPct: "Total return",
    annualizedReturnPct: "Annualized return",
    maxDrawdownPct: "Max drawdown",
    highlights: "Highlights",
    allocation: "Top positions",
    narrative: "Review notes",
    generatedAt: "Generated",
    privacyOn: "Hide amounts",
    privacyOff: "Show amounts",
    privacyLocked: "Report-safe mode",
    percentSuffix: "%",
  },
  "zh-CN": {
    period: "区间",
    startingValue: "期初资产",
    endingValue: "期末资产",
    netContribution: "净投入",
    netProfit: "净收益",
    totalReturnPct: "区间收益",
    annualizedReturnPct: "年化收益",
    maxDrawdownPct: "最大回撤",
    highlights: "重点回顾",
    allocation: "核心持仓",
    narrative: "复盘摘要",
    generatedAt: "生成时间",
    privacyOn: "隐藏金额",
    privacyOff: "显示金额",
    privacyLocked: "报告脱敏模式",
    percentSuffix: "%",
  },
};

export function renderInvestmentShareHtml(input) {
  const report = normalizeReportInput(input);
  const payload = createClientPayload(report);
  const toggleScript = buildToggleScript();

  return `<!doctype html>
<html lang="${escapeAttribute(report.language)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.title)}</title>
    <style>
      :root {
        --bg: #f4efe7;
        --bg-strong: #efe4d6;
        --surface: rgba(255, 252, 247, 0.84);
        --surface-strong: rgba(255, 249, 241, 0.96);
        --text: #201912;
        --muted: #6e5c4f;
        --line: rgba(32, 25, 18, 0.1);
        --accent: #0f766e;
        --accent-soft: rgba(15, 118, 110, 0.14);
        --warm: #c56f4d;
        --warm-soft: rgba(197, 111, 77, 0.14);
        --shadow: 0 24px 70px rgba(60, 39, 18, 0.12);
        --radius-xl: 32px;
        --radius-lg: 24px;
        --radius-md: 18px;
        --font-display: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
        --font-sans: "Avenir Next", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: var(--font-sans);
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(197, 111, 77, 0.18), transparent 32%),
          radial-gradient(circle at 85% 16%, rgba(15, 118, 110, 0.2), transparent 24%),
          linear-gradient(180deg, var(--bg) 0%, #f8f5ef 100%);
      }

      .shell {
        width: min(1180px, calc(100vw - 40px));
        margin: 36px auto;
        padding: 28px;
        border-radius: 36px;
        background: rgba(255, 255, 255, 0.42);
        border: 1px solid rgba(255, 255, 255, 0.45);
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.85fr);
        gap: 22px;
      }

      .hero > *,
      .grid > *,
      .metrics > *,
      .content-grid > *,
      .highlights-list > *,
      .allocation-list > *,
      .hero-meta > * {
        min-width: 0;
      }

      .hero-card,
      .panel,
      .metric-card,
      .highlight-card,
      .allocation-card,
      .narrative-card {
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background: var(--surface);
        backdrop-filter: blur(14px);
      }

      .hero-card {
        padding: 34px;
        background:
          linear-gradient(145deg, rgba(255, 250, 244, 0.96), rgba(248, 241, 232, 0.82)),
          var(--surface);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(32, 25, 18, 0.06);
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      h1 {
        margin: 18px 0 14px;
        font-family: var(--font-display);
        font-size: clamp(42px, 7vw, 72px);
        line-height: 0.94;
        letter-spacing: -0.05em;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .subtitle {
        margin: 0;
        max-width: 46ch;
        color: var(--muted);
        font-size: 17px;
        line-height: 1.65;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .hero-meta {
        margin-top: 24px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .meta-pill,
      .privacy-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 10px 16px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.6);
        color: var(--text);
        font: inherit;
        text-align: center;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      .privacy-button {
        cursor: pointer;
        transition: transform 180ms ease, background 180ms ease;
      }

      .privacy-button:hover {
        transform: translateY(-1px);
        background: rgba(255, 255, 255, 0.9);
      }

      .privacy-button[disabled] {
        cursor: default;
        color: var(--muted);
        background: rgba(255, 255, 255, 0.45);
      }

      .score-panel {
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background:
          linear-gradient(160deg, rgba(15, 118, 110, 0.96), rgba(13, 71, 71, 0.94));
        color: #f7f5ef;
      }

      .score-panel .label {
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        opacity: 0.76;
      }

      .score-value {
        margin-top: 12px;
        font-size: clamp(32px, 5vw, 58px);
        font-weight: 700;
        line-height: 1.02;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .score-note {
        margin-top: 16px;
        color: rgba(247, 245, 239, 0.82);
        line-height: 1.7;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .grid {
        margin-top: 22px;
        display: grid;
        gap: 22px;
      }

      .metrics {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .metric-card {
        padding: 22px;
      }

      .metric-label {
        color: var(--muted);
        font-size: 14px;
      }

      .metric-value {
        margin-top: 12px;
        font-size: clamp(24px, 3vw, 34px);
        font-weight: 700;
        letter-spacing: -0.04em;
        line-height: 1.08;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .metric-value[data-tone="positive"] {
        color: var(--accent);
      }

      .metric-value[data-tone="negative"] {
        color: var(--warm);
      }

      .content-grid {
        grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
        align-items: start;
      }

      .panel {
        padding: 24px;
      }

      .section-title {
        margin: 0 0 18px;
        font-size: 15px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .highlights-list,
      .allocation-list,
      .bullet-list {
        display: grid;
        gap: 14px;
      }

      .highlight-card,
      .allocation-card,
      .narrative-card {
        padding: 18px;
        background: var(--surface-strong);
      }

      .highlight-card strong,
      .allocation-header strong {
        display: block;
        font-size: 15px;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .highlight-value {
        margin-top: 10px;
        font-size: 24px;
        font-weight: 700;
        line-height: 1.15;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .highlight-detail {
        margin-top: 8px;
        color: var(--muted);
        font-size: 14px;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .allocation-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .allocation-meta {
        display: flex;
        gap: 10px;
        color: var(--muted);
        font-size: 14px;
        min-width: 0;
        flex-wrap: wrap;
        justify-content: flex-end;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .allocation-track {
        margin-top: 14px;
        position: relative;
        height: 10px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(32, 25, 18, 0.08);
      }

      .allocation-fill {
        position: absolute;
        inset: 0 auto 0 0;
        border-radius: inherit;
      }

      .bullet-list {
        padding-left: 18px;
        margin: 14px 0 0;
        color: var(--muted);
        line-height: 1.7;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .footer {
        margin-top: 22px;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        color: var(--muted);
        font-size: 13px;
      }

      @media (max-width: 920px) {
        .hero,
        .content-grid,
        .metrics {
          grid-template-columns: 1fr;
        }

        .shell {
          width: min(100vw - 20px, 100%);
          margin: 10px;
          padding: 18px;
          border-radius: 24px;
        }

        .hero-card,
        .score-panel,
        .panel,
        .metric-card {
          padding: 20px;
        }

        .footer {
          flex-direction: column;
        }
      }
    </style>
  </head>
  <body>
    <main id="app">
      <div class="shell">
        <section class="hero">
          <article class="hero-card">
            <div class="eyebrow">${escapeHtml(payload.copy.period)}</div>
            <h1>${escapeHtml(payload.title)}</h1>
            ${payload.subtitle ? `<p class="subtitle">${escapeHtml(payload.subtitle)}</p>` : ""}
            <div class="hero-meta">
              <span class="meta-pill">${escapeHtml(payload.period.label)}</span>
              <span class="meta-pill">${escapeHtml(payload.currency)}</span>
              <button class="privacy-button" data-privacy-toggle type="button" ${payload.privacy.canToggleAmounts ? "" : "disabled"}>${escapeHtml(
                payload.privacy.canToggleAmounts
                  ? payload.privacy.defaultVisible
                    ? payload.copy.privacyOn
                    : payload.copy.privacyOff
                  : payload.copy.privacyLocked,
              )}</button>
            </div>
          </article>
          <aside class="score-panel panel">
            <div>
              <div class="label">${escapeHtml(payload.copy.totalReturnPct)}</div>
              <div class="score-value">${escapeHtml(payload.heroValue)}</div>
            </div>
            <div class="score-note">${escapeHtml(payload.narrative.headline || payload.subtitle || payload.period.label)}</div>
          </aside>
        </section>

        <section class="grid metrics">${renderMetricsHtml(payload.metrics)}</section>

        <section class="grid content-grid">
          <div class="grid">${renderHighlightsHtml(payload.highlights, payload.copy)}${renderNarrativeHtml(payload.narrative, payload.copy)}</div>
          <div class="grid">${renderAllocationHtml(payload.allocation, payload.copy)}</div>
        </section>

        <footer class="footer">
          <span>${escapeHtml(payload.copy.generatedAt)}: ${escapeHtml(payload.generatedAt)}</span>
          <span>${escapeHtml(payload.disclaimer || "")}</span>
        </footer>
      </div>
    </main>
    <script id="investment-report-data" type="application/json">${serializeJson(payload)}</script>
    <script>${toggleScript}</script>
  </body>
</html>`;
}

export async function writeInvestmentShareHtml(input, outputPath) {
  const resolvedOutputPath = resolve(outputPath ?? defaultOutputPath(input));
  const html = renderInvestmentShareHtml(input);
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, html, "utf8");
  return resolvedOutputPath;
}

export function defaultOutputPath(input, cwd = process.cwd()) {
  const report = normalizeReportInput(input);
  const slug = slugify(
    report.title || report.period.label || "investment-report",
  );
  return resolve(cwd, DEFAULT_OUTPUT_DIR, `${slug}.html`);
}

export function normalizeReportInput(input) {
  const report = input ?? {};
  const language = report.language === "en-US" ? "en-US" : "zh-CN";
  const copy = COPY[language];
  const privacy = {
    showAmounts: report.privacy?.showAmounts !== false,
    showAllocationAmounts:
      report.privacy?.showAllocationAmounts ??
      report.privacy?.showAmounts !== false,
    showTickers: report.privacy?.showTickers !== false,
  };
  const period = {
    from: report.period?.from ?? "",
    to: report.period?.to ?? "",
    label:
      report.period?.label ??
      buildPeriodLabel(report.period?.from, report.period?.to, language),
  };

  return {
    title: report.title ?? defaultTitle(period.label, language),
    subtitle: report.subtitle ?? "",
    language,
    currency: report.currency ?? "USD",
    privacy,
    period,
    summary: {
      startingValue: toNumber(report.summary?.startingValue),
      endingValue: toNumber(report.summary?.endingValue),
      netContribution: toNumber(report.summary?.netContribution),
      netProfit: toNumber(report.summary?.netProfit),
      totalReturnPct: toNumber(report.summary?.totalReturnPct),
      annualizedReturnPct: toOptionalNumber(
        report.summary?.annualizedReturnPct,
      ),
      maxDrawdownPct: toOptionalNumber(report.summary?.maxDrawdownPct),
    },
    highlights: normalizeHighlights(report.highlights),
    allocation: normalizeAllocation(report.allocation, privacy.showTickers),
    narrative: {
      headline: report.narrative?.headline ?? "",
      bullets: Array.isArray(report.narrative?.bullets)
        ? report.narrative.bullets.map((item) => String(item))
        : [],
    },
    disclaimer:
      report.disclaimer ??
      (language === "zh-CN"
        ? "仅供分享与复盘使用，不构成投资建议。"
        : "For sharing and review only. This is not investment advice."),
    generatedAt: report.generatedAt ?? new Date().toISOString(),
    copy,
  };
}

function createClientPayload(report) {
  const summaryCards = [
    {
      label: report.copy.startingValue,
      kind: "amount",
      amount: buildAmountEntry(
        report.summary.startingValue,
        report.currency,
        report.language,
        report.privacy.showAmounts,
      ),
      tone: toneForValue(report.summary.startingValue),
    },
    {
      label: report.copy.endingValue,
      kind: "amount",
      amount: buildAmountEntry(
        report.summary.endingValue,
        report.currency,
        report.language,
        report.privacy.showAmounts,
      ),
      tone: toneForValue(report.summary.endingValue),
    },
    {
      label: report.copy.netContribution,
      kind: "amount",
      amount: buildAmountEntry(
        report.summary.netContribution,
        report.currency,
        report.language,
        report.privacy.showAmounts,
      ),
      tone: toneForValue(report.summary.netContribution),
    },
    {
      label: report.copy.netProfit,
      kind: "amount",
      amount: buildAmountEntry(
        report.summary.netProfit,
        report.currency,
        report.language,
        report.privacy.showAmounts,
      ),
      tone: toneForValue(report.summary.netProfit),
    },
    {
      label: report.copy.totalReturnPct,
      kind: "percent",
      display: formatPercent(report.summary.totalReturnPct),
      tone: toneForValue(report.summary.totalReturnPct),
    },
  ];

  if (report.summary.annualizedReturnPct !== null) {
    summaryCards.push({
      label: report.copy.annualizedReturnPct,
      kind: "percent",
      display: formatPercent(report.summary.annualizedReturnPct),
      tone: toneForValue(report.summary.annualizedReturnPct),
    });
  }

  if (report.summary.maxDrawdownPct !== null) {
    summaryCards.push({
      label: report.copy.maxDrawdownPct,
      kind: "percent",
      display: formatPercent(report.summary.maxDrawdownPct),
      tone: toneForValue(report.summary.maxDrawdownPct),
    });
  }

  const canToggleAmounts =
    report.privacy.showAmounts || report.privacy.showAllocationAmounts;

  return {
    title: report.title,
    subtitle: report.subtitle,
    period: report.period,
    currency: report.currency,
    copy: report.copy,
    generatedAt: formatGeneratedAt(report.generatedAt, report.language),
    disclaimer: report.disclaimer,
    heroValue: formatPercent(report.summary.totalReturnPct),
    privacy: {
      canToggleAmounts,
      defaultVisible: report.privacy.showAmounts,
    },
    metrics: summaryCards,
    highlights: report.highlights,
    allocation: report.allocation.map((item) => ({
      name: item.name,
      weight: formatPercent(item.weight),
      amount: buildAmountEntry(
        item.amount,
        report.currency,
        report.language,
        report.privacy.showAllocationAmounts,
      ),
      color: item.color,
    })),
    narrative: report.narrative,
  };
}

function renderMetricsHtml(metrics) {
  return metrics
    .map((metric) => {
      const tone = metric.tone ?? "neutral";
      const content =
        metric.kind === "amount"
          ? renderSensitiveValue(metric.amount)
          : escapeHtml(metric.display ?? MASK);

      return `<article class="metric-card"><div class="metric-label">${escapeHtml(metric.label)}</div><div class="metric-value" data-tone="${escapeAttribute(
        tone,
      )}">${content}</div></article>`;
    })
    .join("");
}

function renderHighlightsHtml(highlights, copy) {
  if (!highlights.length) {
    return "";
  }

  return `<section class="panel"><h2 class="section-title">${escapeHtml(copy.highlights)}</h2><div class="highlights-list">${highlights
    .map(
      (item) =>
        `<article class="highlight-card"><strong>${escapeHtml(item.label)}</strong><div class="highlight-value">${escapeHtml(
          item.value,
        )}</div>${item.detail ? `<div class="highlight-detail">${escapeHtml(item.detail)}</div>` : ""}</article>`,
    )
    .join("")}</div></section>`;
}

function renderAllocationHtml(allocation, copy) {
  if (!allocation.length) {
    return "";
  }

  return `<section class="panel"><h2 class="section-title">${escapeHtml(copy.allocation)}</h2><div class="allocation-list">${allocation
    .map(
      (item) =>
        `<article class="allocation-card"><div class="allocation-header"><strong>${escapeHtml(
          item.name,
        )}</strong><div class="allocation-meta"><span>${escapeHtml(item.weight)}</span><span>${renderSensitiveValue(
          item.amount,
        )}</span></div></div><div class="allocation-track"><div class="allocation-fill" style="width: ${escapeAttribute(
          item.weight,
        )}; background: ${escapeAttribute(item.color)}"></div></div></article>`,
    )
    .join("")}</div></section>`;
}

function renderNarrativeHtml(narrative, copy) {
  if (!narrative.headline && !narrative.bullets.length) {
    return "";
  }

  return `<section class="panel narrative-card"><h2 class="section-title">${escapeHtml(copy.narrative)}</h2>${
    narrative.headline
      ? `<strong>${escapeHtml(narrative.headline)}</strong>`
      : ""
  }${
    narrative.bullets.length
      ? `<ul class="bullet-list">${narrative.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
      : ""
  }</section>`;
}

function renderSensitiveValue(entry) {
  if (!entry) {
    return escapeHtml(MASK);
  }

  const initial = entry.locked ? entry.masked : entry.visible;
  return `<span class="js-sensitive" data-masked="${escapeAttribute(entry.masked)}" data-visible="${escapeAttribute(
    entry.visible,
  )}" data-locked="${entry.locked ? "true" : "false"}">${escapeHtml(initial)}</span>`;
}

function buildToggleScript() {
  return [
    'const payload = JSON.parse(document.getElementById("investment-report-data").textContent);',
    'const button = document.querySelector("[data-privacy-toggle]");',
    'const sensitiveNodes = Array.from(document.querySelectorAll(".js-sensitive"));',
    "let revealAmounts = Boolean(payload.privacy && payload.privacy.canToggleAmounts && payload.privacy.defaultVisible);",
    "",
    "function syncSensitiveValues() {",
    "  sensitiveNodes.forEach((node) => {",
    '    const isLocked = node.dataset.locked === "true";',
    "    node.textContent = isLocked ? node.dataset.masked : revealAmounts ? node.dataset.visible : node.dataset.masked;",
    "  });",
    "",
    "  if (!button) {",
    "    return;",
    "  }",
    "",
    "  if (!payload.privacy || !payload.privacy.canToggleAmounts) {",
    "    button.textContent = payload.copy.privacyLocked;",
    "    return;",
    "  }",
    "",
    "  button.textContent = revealAmounts ? payload.copy.privacyOn : payload.copy.privacyOff;",
    "}",
    "",
    "if (button && payload.privacy && payload.privacy.canToggleAmounts) {",
    '  button.addEventListener("click", () => {',
    "    revealAmounts = !revealAmounts;",
    "    syncSensitiveValues();",
    "  });",
    "}",
    "",
    "syncSensitiveValues();",
  ].join("\n");
}

function buildAmountEntry(value, currency, language, isVisible) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return {
      visible: MASK,
      masked: MASK,
      locked: true,
    };
  }

  const visible = formatCurrency(value, currency, language);
  if (!isVisible) {
    return {
      visible: MASK,
      masked: MASK,
      locked: true,
    };
  }

  return {
    visible,
    masked: MASK,
    locked: false,
  };
}

function toneForValue(value) {
  if (typeof value !== "number" || Number.isNaN(value) || value === 0) {
    return "neutral";
  }

  return value > 0 ? "positive" : "negative";
}

function normalizeHighlights(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      label: String(item?.label ?? ""),
      value: String(item?.value ?? ""),
      detail: item?.detail ? String(item.detail) : "",
    }))
    .filter((item) => item.label || item.value || item.detail);
}

function normalizeAllocation(items, showTickers) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => ({
      name: showTickers
        ? String(item?.name ?? `Asset ${index + 1}`)
        : `Asset ${index + 1}`,
      weight: toNumber(item?.weight),
      amount: toOptionalNumber(item?.amount),
      color: String(item?.color ?? pickColor(index)),
    }))
    .filter(
      (item) => typeof item.weight === "number" && !Number.isNaN(item.weight),
    );
}

function defaultTitle(periodLabel, language) {
  if (language === "zh-CN") {
    return periodLabel ? `${periodLabel} 投资报告` : "投资报告";
  }
  return periodLabel ? `${periodLabel} investment report` : "Investment report";
}

function buildPeriodLabel(from, to, language) {
  if (from && to) {
    return `${from} - ${to}`;
  }

  if (from || to) {
    return from || to;
  }

  return language === "zh-CN" ? "未指定区间" : "Unspecified period";
}

function formatCurrency(value, currency, language) {
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return MASK;
  }

  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toFixed(Number.isInteger(rounded) ? 0 : 1)}%`;
}

function formatGeneratedAt(value, language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function slugify(value) {
  return (
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "investment-report"
  );
}

function serializeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pickColor(index) {
  const palette = [
    "#0f766e",
    "#c56f4d",
    "#3949ab",
    "#a855f7",
    "#d97706",
    "#2563eb",
  ];
  return palette[index % palette.length];
}
