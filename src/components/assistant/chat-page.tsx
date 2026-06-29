import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
  ChevronLeftIcon,
  HamburgerMenuIcon,
  ChevronRightIcon,
  GearIcon,
  RocketIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { useChat } from "./use-chat";
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
import {
  appendMessages,
  buildSessionPreview,
  generateTitle,
  loadSession,
  renameSession,
  touchSession,
  onSessionUpdate,
  notifySessionUpdate,
} from "@/middlelayers/ai";
import type { PersistedBlock, PersistedChatMessage } from "@/middlelayers/ai";
import SessionSidebar from "./session-sidebar";
import { useChatSessions } from "./use-chat-sessions";
import type { AIConfig, CurrencyRateDetail } from "@/middlelayers/types";
import type { ChatMessage, AssistantBlock } from "./use-chat";
import type { ChartSpec } from "@/middlelayers/types";

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; config: AIConfig; baseCurrency: CurrencyRateDetail }
  | { status: "error"; message: string };

export default function ChatPage({ isProUser }: { isProUser: boolean }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

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

  return (
    <ReadyChat
      config={state.config}
      baseCurrency={state.baseCurrency}
    />
  );
}

function persistedToRuntime(msg: PersistedChatMessage): ChatMessage {
  if (msg.role === "user") {
    return { role: "user", content: msg.content };
  }
  return {
    role: "assistant",
    blocks: msg.blocks.map((b): AssistantBlock => {
      if (b.kind === "text") return b;
      return { kind: "chart", chart: b.chart as ChartSpec };
    }),
  };
}

function runtimeToPersisted(msg: ChatMessage): PersistedChatMessage {
  if (msg.role === "user") {
    return { role: "user", content: msg.content };
  }
  return {
    role: "assistant",
    blocks: msg.blocks
      .filter((b): b is Exclude<AssistantBlock, { kind: "think" } | { kind: "agent_activity" }> => b.kind !== "think" && b.kind !== "agent_activity")
      .map((b): PersistedBlock => {
        if (b.kind === "text") return { kind: "text", text: b.text };
        return { kind: "chart", chart: b.chart };
      }),
  };
}

function ReadyChat({
  config,
  baseCurrency,
}: {
  config: AIConfig;
  baseCurrency: CurrencyRateDetail;
}) {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);
  const { sessions, isLoading, refresh, createNew, remove, pin } =
    useChatSessions();
  const [initialMsgs, setInitialMsgs] = useState<ChatMessage[]>([]);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);

  useEffect(() => {
    if (sessionId) {
      // Only clear messages when switching to a different session.
      // Avoid clearing on sessionVersion bumps (e.g. after stream
      // completion persistence), which would reset the scroll position
      // and cause an unwanted auto-scroll from top to bottom.
      if (sessionId !== loadedSessionId) {
        setInitialMsgs([]);
      }
      let cancelled = false;
      (async () => {
        const session = await loadSession(sessionId).catch(() => null);
        if (cancelled) return;
        if (session) {
          setInitialMsgs(session.messages.map(persistedToRuntime));
        } else {
          // New or empty session — always reset so the previous session's
          // messages don't leak into the new chat.
          setInitialMsgs([]);
        }
        setLoadedSessionId(sessionId);
      })();
      return () => { cancelled = true; };
    } else {
      // No sessionId — render a fresh empty chat without creating a
      // session.  A new session is created lazily when the user sends
      // their first message (see handleStreamComplete).
      setInitialMsgs([]);
      setLoadedSessionId(null);
    }
  }, [sessionId, sessionVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to session update notifications from orphaned background
  // streams (e.g. when the user navigated away mid-stream and an old
  // send() completed after the new component mounted). Bump sessionVersion
  // to trigger a re-fetch of the session data via the effect above.
  useEffect(() => {
    if (!sessionId) return;
    return onSessionUpdate(sessionId, () => {
      setSessionVersion(v => v + 1);
    });
  }, [sessionId]);

  // The effect above loads session data and initializes initialMsgs.
  // The useChat hook's initialMessages watcher picks up the new
  // messages via reference comparison when loading completes.
	  const handleStreamComplete = useCallback(
	    async (newMessages: ChatMessage[]) => {
      try {
        if (newMessages.length < 2) return;
        const exchange = [
          newMessages[newMessages.length - 2],
          newMessages[newMessages.length - 1],
        ];
        if (exchange.length < 2) return;
        const persistedExchange = exchange.map(runtimeToPersisted);

        let targetId = sessionId ?? undefined;
        if (!targetId) {
          // Lazy session creation on first message
          const meta = await createNew();
          targetId = meta.id;
        }

        await appendMessages(targetId, persistedExchange);
        const allPersisted = newMessages.map(runtimeToPersisted);
        const msgCount = newMessages.length;
        await touchSession(targetId, {
          messageCount: msgCount,
          preview: buildSessionPreview(allPersisted),
        });

        // Auto-generate title after the first exchange in a new session
        if (msgCount === 2) {
          const firstUser = newMessages[0];
          const firstAssistant = newMessages[1];
          if (firstAssistant.role !== "assistant") return;
          const userContent =
            firstUser.role === "user" ? firstUser.content : "";
          const assistantText = (firstAssistant as { role: "assistant"; blocks: AssistantBlock[] }).blocks
            .filter((b: AssistantBlock): b is AssistantBlock & { kind: "text" } => b.kind === "text")
            .map((b) => b.text)
            .join("");
          if (userContent) {
            const title = await generateTitle(config, userContent, assistantText);
            if (title) {
              await renameSession(targetId, title);
            }
          }
        }

        if (!sessionId) {
          navigate(`/assistant/${targetId}`, { replace: true });
        }

        await refresh();
        // Notify any newly mounted component (e.g. after navigation away
        // and back) that the session data has been persisted. The
        // subscription effect in ReadyChat will bump sessionVersion,
        // triggering a re-fetch of the session messages.
        notifySessionUpdate(targetId);
      } catch (err) {
        // Log but don't throw — the streamed messages in React state
        // are still visible in the UI; only the DB persistence failed.
        console.error("Failed to persist chat exchange:", err);
      }
    },
    [sessionId, navigate, refresh],
  );

	  // Hooks must be before the conditional early return so hook ordering
	  // is consistent across renders.
	  const handleToggleSidebar = useCallback(() => {
	    setSidebarOpen((prev) => !prev);
	  }, []);

  const handleStreamingChange = useCallback(
    (streaming: boolean) => {
      setProcessingSessionId(streaming ? (sessionId ?? null) : null);
    },
    [sessionId],
  );

  const handleNewChat = useCallback(async () => {
    const meta = await createNew();
    navigate(`/assistant/${meta.id}`);
  }, [createNew, navigate]);

  const handleSelectSession = useCallback(
    (id: string) => {
      navigate(`/assistant/${id}`);
    },
   [navigate],
 );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await remove(id);
      // If the deleted session is the currently active one, navigate
      // back to the no-session state so the chat area resets to the
      // welcome/empty panel instead of showing stale messages.
      if (id === sessionId) {
        navigate(`/assistant`, { replace: true });
      }
    },
    [remove, sessionId, navigate],
  );

	  return (
	    <div
      className="flex h-[calc(100vh-88px)] overflow-hidden"
      data-testid="chat-session-layout"
    >
      <div
        className={`overflow-hidden transition-[width] duration-200 ease-in-out ${
          sidebarOpen ? "w-[260px]" : "w-0"
        }`}
      >
        <div className="w-[260px]">
          <SessionSidebar
            sessions={sessions}
            activeId={sessionId ?? null}
            isLoading={isLoading}
        onSelect={handleSelectSession}
        onNew={handleNewChat}
        onDelete={handleDeleteSession}
        onPin={pin}
          processingId={processingSessionId}
       />
        </div>
      </div>
     <ChatContent
       sessionId={sessionId ?? null}
       config={config}
       baseCurrency={baseCurrency}
       initialMessages={initialMsgs}
       onStreamComplete={handleStreamComplete}
        onStreamingChange={handleStreamingChange}
       sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
     />
    </div>
  );
}

function ChatContent({
  config,
  baseCurrency,
  sessionId,
  initialMessages,
  onStreamComplete,
  onStreamingChange,
  sidebarOpen,
  onToggleSidebar,
}: {
  config: AIConfig;
  baseCurrency: CurrencyRateDetail;
  sessionId?: string | null;
  initialMessages: ChatMessage[];
  onStreamComplete?: (messages: ChatMessage[]) => void;
  onStreamingChange?: (streaming: boolean) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { t } = useTranslation();
  const chat = useChat({ config, baseCurrency, sessionId, initialMessages, onStreamComplete, onStreamingChange });

  return (
    <Card
      data-testid="chat-card"
      className="flex min-w-0 flex-1 flex-col overflow-hidden"
    >
      <ChatHeader config={config} sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} />
      <ChatThread
        messages={chat.messages}
        isStreaming={chat.isStreaming}
        onPickPrompt={(text) => void chat.send(text)}
      />
      {chat.messages.length > 0 && (
        <QuickActions
          disabled={chat.isStreaming}
          onRun={(key) => {
            const k = key as keyof typeof QUICK_ACTION_KEYS;
            void chat.runQuickAction(k, quickActionPrompt(QUICK_ACTION_KEYS[k]));
          }}
        />
      )}
      <ChatComposer
        value={chat.input}
        onChange={chat.setInput}
          onSend={(text) => void (text ? chat.send(text) : chat.send())}
        onStop={chat.stop}
        isStreaming={chat.isStreaming}
        disabled={false}
      />
    </Card>
  );
}

function ChatHeader({ config, sidebarOpen, onToggleSidebar }: { config: AIConfig; sidebarOpen: boolean; onToggleSidebar: () => void }) {
  const { t } = useTranslation();
  return (
    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-[var(--glass-border)] bg-card/40 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarOpen ? t("ai.session.hide") : t("ai.session.show")}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          data-testid="sidebar-toggle"
        >
          {sidebarOpen ? (
            <ChevronLeftIcon className="h-4 w-4" />
          ) : (
            <HamburgerMenuIcon className="h-4 w-4" />
          )}
        </button>
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
                  className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
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
