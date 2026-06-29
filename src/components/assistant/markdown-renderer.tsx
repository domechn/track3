import { useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/**
 * Renders AI assistant reply text as styled Markdown.
 *
 * Supports:
 *  - GFM tables, task lists, strikethrough, auto-links
 *  - Syntax-highlighted code blocks (via <code> styling + kbd for inline)
 *  - External links opened by the system browser
 *  - Paragraphs, headings, lists, blockquotes
 *
 * Components are intentionally lightweight — no Prose/Typography plugin,
 * just Tailwind utilities + CSS variables already in the design system.
 */

function LinkRenderer({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!href) return;
      // Only intercept absolute HTTP links — relative/internal anchors
      // (<a name>, #hash) should behave normally.
      if (!href.startsWith("http://") && !href.startsWith("https://")) return;
      e.preventDefault();
      import("@tauri-apps/plugin-opener")
        .then((mod) => mod.openUrl(href))
        .catch(() => {
          // Fallback when not in Tauri (e.g. in-browser dev, tests):
          // let the browser handle the link natively.
          window.open(href, "_blank", "noopener");
        });
    },
    [href],
  );

  return (
    <a
      href={href}
      onClick={handleClick}
      className="font-medium text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const isInline = !className;
  if (isInline) {
    return (
      <code className="rounded-md bg-accent/70 px-1.5 py-0.5 text-[13px] font-medium text-foreground before:content-none after:content-none">
        {children}
      </code>
    );
  }
  // Block code — extract language from "language-xxx"
  const lang = className?.replace("language-", "") ?? "";
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-[var(--glass-border)] bg-accent/40">
      {lang && (
        <div className="border-b border-[var(--glass-border)] bg-accent/20 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {lang}
        </div>
      )}
      <div className="overflow-x-auto p-3">
        <code className="block text-[13px] leading-relaxed font-[family-name:var(--font-mono)] text-foreground/90">
          {children}
        </code>
      </div>
    </div>
  );
}

const components: Components = {
  a: LinkRenderer,
  code: CodeBlock,
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 text-sm leading-relaxed text-foreground/90">
      {children}
    </p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-base font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-[15px] font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-3 text-sm font-semibold text-foreground first:mt-0">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground/90 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-foreground/90 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-primary/30 pl-4 text-sm italic text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="my-4 border-t border-[var(--glass-border)] last:mb-0" />
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-[var(--glass-border)] bg-accent/30">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-[var(--glass-border)] last:border-0">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm text-foreground/80">{children}</td>
  ),
  pre: ({ children }) => <>{children}</>,
};

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
