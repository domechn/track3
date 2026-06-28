import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  GearIcon,
  PlusIcon,
  RocketIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { useChat } from "./use-chat";
import { useChatSessions } from "./use-chat-sessions";
import SessionSidebar from "./session-sidebar";
import ChatThread from "./chat-thread";
import ChatComposer from "./chat-composer";
import QuickActions, {
  QUICK_ACTION_KEYS,
  quickActionPrompt,
} from "./quick-actions";
import {
  AIConfigMissingError,
  loadAIConfig,
  queryPreferCurrency,
} from "@/middlelayers/configuration";
import type { AIConfig, CurrencyRateDetail } from "@/middlelayers/types";

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; config: AIConfig; baseCurrency: CurrencyRateDetail }
  | { status: "error"; message: string };

function EmptySession({ onCreateNew }: { onCreateNew: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <p className="text-center text-sm text-muted-foreground">
        {t("ai.session.empty")}
      </p>
      <Button
        onClick={onCreateNew}
        className="gap-1.5"
        data-testid="session-empty-cta"
      >
        <PlusIcon className="h-4 w-4" />
        {t("ai.session.newChat")}
      </Button>
    </div>
  );
}

function ChatCard({
  config,
  baseCurrency,
  sessionId,
}: {
  config: AIConfig;
  baseCurrency: CurrencyRateDetail;
  sessionId: string;
}) {
  const chat = useChat({ config, baseCurrency, sessionId });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ChatHeader config={config} />
      <ChatThread
        messages={chat.messages}
        isStreaming={chat.isStreaming}
        onPickPrompt={(text) => void chat.send(text)}
      />
      {(chat.messages.length > 0 || chat.isStreaming) && (
        <QuickActions
          disabled={chat.isStreaming}
          onRun={(key) => {
            const k = key as keyof typeof QUICK_ACTION_KEYS;
            void chat.runQuickAction(
              k,
              quickActionPrompt(QUICK_ACTION_KEYS[k]),
            );
          }}
        />
      )}
      <ChatComposer
        value={chat.input}
        onChange={chat.setInput}
        onSend={() => void chat.send()}
        onStop={chat.stop}
        isStreaming={chat.isStreaming}
        disabled={false}
      />
    </div>
  );
}

export default function ChatPage({ isProUser }: { isProUser: boolean }) {
  const { sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();
  const {
    sessions,
    isLoading: sessionsLoading,
    createNew,
    remove,
    pin,
  } = useChatSessions();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Redirect to the first session when sessions load and no URL sessionId.
  useEffect(() => {
    if (!sessionsLoading && !urlSessionId && sessions.length > 0) {
      navigate(`/assistant/${sessions[0].id}`, { replace: true });
    }
  }, [sessionsLoading, urlSessionId, sessions, navigate]);

  // If the URL sessionId doesn't exist in the list, redirect to /assistant.
  useEffect(() => {
    if (urlSessionId && !sessionsLoading && sessions.length > 0) {
      const exists = sessions.some((s) => s.id === urlSessionId);
      if (!exists) {
        navigate("/assistant", { replace: true });
      }
    }
  }, [urlSessionId, sessionsLoading, sessions, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [config, baseCurrency] = await Promise.all([
          loadAIConfig(),
          queryPreferCurrency(),
        ]);
        if (cancelled) return;
        setState({ status: "ready", config, baseCurrency });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AIConfigMissingError) {
          setState({ status: "missing" });
          return;
        }
        setState({
          status: "error",
          message: (err as Error).message ?? String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNew = useCallback(async () => {
    const meta = await createNew();
    navigate(`/assistant/${meta.id}`);
  }, [createNew, navigate]);

  const handleDelete = useCallback(
    async (id: string) => {
      const wasActive = id === urlSessionId;
      await remove(id);
      if (wasActive) {
        navigate("/assistant", { replace: true });
      }
    },
    [remove, urlSessionId, navigate],
  );

  const handleSelect = useCallback(
    (sid: string) => {
      navigate(`/assistant/${sid}`);
    },
    [navigate],
  );

  const handlePin = useCallback(
    async (id: string, pinned: boolean) => {
      await pin(id, pinned);
    },
    [pin],
  );

  // Full-width Card for non-ready states.
  if (!isProUser) {
    return <UpgradeCard />;
  }

  if (state.status === "loading") {
    return <LoadingCard />;
  }

  if (state.status === "missing") {
    return <NotConfiguredCard />;
  }

  if (state.status === "error") {
    return <ErrorCard message={state.message} />;
  }

  // Ready state — two-column layout with sidebar.
  const showEmpty = !urlSessionId && !sessionsLoading && sessions.length === 0;
  const content = showEmpty ? (
    <EmptySession onCreateNew={handleNew} />
  ) : urlSessionId ? (
    <ChatCard
      config={state.config}
      baseCurrency={state.baseCurrency}
      sessionId={urlSessionId}
    />
  ) : (
    <LoadingCard />
  );

  return (
    <div
      className="flex h-[calc(100vh-88px)] min-h-0 overflow-hidden rounded-lg border border-[var(--glass-border)] bg-card/60 backdrop-blur-sm"
      data-testid="chat-card"
    >
      <SessionSidebar
        sessions={sessions}
        activeId={urlSessionId ?? null}
        isLoading={sessionsLoading}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
        onPin={handlePin}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {content}
      </div>
    </div>
  );
}

function ChatHeader({ config }: { config: AIConfig }) {
  const { t } = useTranslation();
  return (
    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-[var(--glass-border)] bg-card/40 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <RocketIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold leading-tight">
            {t("assistant.chat.title")}
          </CardTitle>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{config.model}</span>
            <span className="mx-1.5 opacity-50">·</span>
            <span className="font-mono">{config.endpoint}</span>
          </p>
        </div>
      </div>
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="gap-1 text-muted-foreground hover:text-foreground"
        data-testid="chat-open-settings"
      >
        <Link to="/settings/assistant">
          <GearIcon className="h-3.5 w-3.5" />
          {t("settings.tab.assistant")}
        </Link>
      </Button>
    </CardHeader>
  );
}

function LoadingCard() {
  return (
    <Card className="flex h-[calc(100vh-88px)] min-h-0 flex-col overflow-hidden md:min-h-[560px]">
      <div className="flex items-center gap-3 border-b border-[var(--glass-border)] bg-card/40 px-5 py-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-16 w-2/3 rounded-2xl" />
        <Skeleton className="h-24 w-3/4 rounded-2xl" />
        <Skeleton className="h-12 w-1/2 rounded-2xl" />
      </div>
      <div className="border-t border-[var(--glass-border)] p-3">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </Card>
  );
}

function NotConfiguredCard() {
  const { t } = useTranslation();
  const capabilities = [
    "assistant.chat.capabilities.summary",
    "assistant.chat.capabilities.history",
    "assistant.chat.capabilities.compare",
    "assistant.chat.capabilities.market",
    "assistant.chat.capabilities.health",
    "assistant.chat.capabilities.recent",
  ];
  return (
    <Card className="overflow-hidden" data-testid="assistant-not-configured">
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.06] to-transparent"
        />
        <CardHeader className="relative space-y-3 pb-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"
            >
              <RocketIcon className="h-4 w-4" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {t("assistant.empty.localBadge")}
            </span>
          </div>
          <CardTitle className="text-lg font-semibold tracking-tight">
            {t("assistant.empty.title")}
          </CardTitle>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {t("assistant.empty.description")}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("assistant.chat.capabilities.title")}
            </p>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {capabilities.map((c) => (
                <li
                  key={c}
                  className="flex items-center gap-2 text-sm text-foreground/80"
                >
                  <CapabilityDot />
                  {t(c)}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {t("assistant.chat.privacy")}
            </p>
            <Button asChild className="gap-1.5">
              <Link to="/settings/assistant" data-testid="assistant-empty-cta">
                {t("assistant.empty.cta")}
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function CapabilityDot() {
  return (
    <span
      aria-hidden
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
    >
      <CheckIcon className="h-2.5 w-2.5" />
    </span>
  );
}

function ErrorCard({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <Card data-testid="assistant-error">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-base">
          {t("assistant.chat.error.title")}
        </CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("assistant.chat.error.network")}
        </p>
        {message ? (
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-destructive/20 bg-destructive/[0.04] p-2 font-mono text-[11px] text-destructive/80">
            {message}
          </pre>
        ) : null}
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/settings/assistant">
            {t("assistant.chat.error.openSettings")}
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function UpgradeCard() {
  const { t } = useTranslation();
  const bullets = [
    "assistant.upgrade.bullet.endpoint",
    "assistant.upgrade.bullet.skills",
    "assistant.upgrade.bullet.charts",
    "assistant.upgrade.bullet.privacy",
  ];
  return (
    <Card className="overflow-hidden" data-testid="assistant-upgrade">
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-500/[0.08] to-transparent"
        />
        <CardHeader className="relative space-y-3 pb-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"
            >
              <RocketIcon className="h-4 w-4" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Pro
            </span>
          </div>
          <CardTitle className="text-lg font-semibold tracking-tight">
            {t("assistant.upgrade.title")}
          </CardTitle>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {t("assistant.upgrade.description")}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <ul className="space-y-2">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2.5 text-sm text-foreground/85"
              >
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                >
                  <CheckIcon className="h-2.5 w-2.5" />
                </span>
                <span>{t(b)}</span>
              </li>
            ))}
          </ul>
          <Button asChild className="gap-1.5">
            <Link to="/settings/systemInfo" data-testid="assistant-upgrade-cta">
              {t("assistant.upgrade.cta")}
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </div>
    </Card>
  );
}
