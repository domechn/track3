import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/i18n";

function safeUrl(href: string | undefined) {
  try {
    const url = new URL(href ?? "");
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function ReleaseLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  const { t } = useTranslation();
  const [openError, setOpenError] = useState(false);
  const url = safeUrl(href);
  if (!url) return <span>{children}</span>;
  const label = typeof children === "string" && /^https?:\/\//.test(children)
    ? (() => {
      const parsed = new URL(url);
      const text = parsed.host + parsed.pathname;
      return text.length > 48
        ? `${parsed.host}/…/${parsed.pathname.split("/").filter(Boolean).slice(-2).join("/")}`
        : text;
    })()
    : children;
  return <><button type="button" role="link" className="t3-release-notes-link"
    onClick={() => { setOpenError(false); void openUrl(url).catch(() => setOpenError(true)); }}>{label}</button>
    {openError && <span role="alert" className="t3-release-notes-error">{t("update.fidelity.releaseLinkOpenFailed")}</span>}</>;
}

const components: Components = {
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h4>{children}</h4>,
  h3: ({ children }) => <h4>{children}</h4>,
  a: ReleaseLink,
  img: ({ alt }) => <span>{alt}</span>,
};

export default function ReleaseNotes({ content }: { content: string }) {
  const { t } = useTranslation();
  const normalized = content
    .replace(/^((?:[-*+]|\d+[.)]) [^\n]*)\n(?=[^\s>#*+\-\d])/gm, "$1\n\n")
    .replace(/^([^\s#>*+\-\d][^\n.!?:]{0,39})\n(?=[-*] )/gm, "## $1\n");
  return <div className="t3-update-fidelity-notes" role="region" aria-label={t("fidelity.settingsB.about.fullNotes")}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>{normalized}</ReactMarkdown>
  </div>;
}
