import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  generateTitle,
  loadSession,
  renameSession,
  onSessionUpdate,
  notifySessionUpdate,
} from "@/middlelayers/ai";
import type { PersistedBlock, PersistedChatMessage } from "@/middlelayers/ai";
import SessionSidebar from "./session-sidebar";
import { useChatSessions } from "./use-chat-sessions";
import type { AIConfig, CurrencyRateDetail } from "@/middlelayers/types";
import { configuredSecretValues, redactSecrets } from "@/middlelayers/security/redact";
import type { ChatMessage, AssistantBlock } from "./use-chat";
import type { ConversationSummary } from "@/middlelayers/ai/history";
import UsageLabel from "./usage-label";
import { ASSISTANT_APP_ACTION_EVENT } from "@/middlelayers/ai/actions";
import { INSIGHT_QUESTION_STORAGE_KEY } from "@/middlelayers/insights-service";
import { takePendingAssistantQuestion } from "@/middlelayers/ai/pending-question";

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; config: AIConfig; baseCurrency: CurrencyRateDetail }
  | { status: "error"; message: string };

export default function ChatPage({ isProUser }: { isProUser: boolean }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const refreshCurrency = () => {
      void queryPreferCurrency().then((currency) => setState((previous) =>
        previous.status === "ready" ? { ...previous, baseCurrency: currency } : previous)).catch(() => {});
    };
    window.addEventListener(ASSISTANT_APP_ACTION_EVENT, refreshCurrency);
    return () => window.removeEventListener(ASSISTANT_APP_ACTION_EVENT, refreshCurrency);
  }, []);

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
          message: redactSecrets((err as Error).message ?? String(err)),
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
    ...(msg.usage ? { usage: msg.usage } : {}),
    ...(msg.contextTokens !== undefined ? { contextTokens: msg.contextTokens } : {}),
    blocks: msg.blocks
      .filter((b) => b.kind === "text" || b.kind === "pending_action")
      .map((b) => b as AssistantBlock),
  };
}

function runtimeToPersisted(msg: ChatMessage): PersistedChatMessage {
  if (msg.role === "user") {
    return { role: "user", content: msg.content };
  }
  return {
    role: "assistant",
    ...(msg.usage ? { usage: msg.usage } : {}),
    ...(msg.contextTokens !== undefined ? { contextTokens: msg.contextTokens } : {}),
    blocks: msg.blocks
      .filter((b) => b.kind === "pending_action" || (b.kind === "text" && b.text.trim().length > 0))
      .map((b) => b as PersistedBlock),
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
  const secrets = useMemo(() => configuredSecretValues(config), [config]);
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);
  const { sessions, isLoading, refresh, createNew, remove, pin } =
    useChatSessions();
  const [initialMsgs, setInitialMsgs] = useState<ChatMessage[]>([]);
  const [initialSummary, setInitialSummary] = useState<ConversationSummary | undefined>();
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [noSessionEpoch, setNoSessionEpoch] = useState(0);
  const noSessionEpochRef = useRef(0);
  const inNoSessionRef = useRef(!sessionId);
  const newSessionRef = useRef<Promise<string> | null>(null);
  const createdSessionIdRef = useRef<string | null>(null);
  const currentSessionIdRef = useRef(sessionId);
  currentSessionIdRef.current = sessionId;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (sessionId) {
      inNoSessionRef.current = false;
      setSessionLoadError(null);
      // The live chat already holds this session's messages. Reloading here
      // could replace a follow-up sent while the first exchange is saved.
      if (sessionId === createdSessionIdRef.current && loadedSessionId !== sessionId) {
        createdSessionIdRef.current = null;
        setLoadedSessionId(sessionId);
        return;
      }
      // Only clear messages when switching to a different session.
      // Avoid clearing on sessionVersion bumps (e.g. after stream
      // completion persistence), which would reset the scroll position
      // and cause an unwanted auto-scroll from top to bottom.
      if (sessionId !== loadedSessionId) {
        setInitialMsgs([]);
        setInitialSummary(undefined);
      }
      let cancelled = false;
      (async () => {
        let session;
        try {
          session = await loadSession(sessionId);
        } catch (error) {
          if (!cancelled) setSessionLoadError(redactSecrets((error as Error).message ?? String(error), secrets));
          return;
        }
        if (cancelled) return;
        if (session) {
          setInitialMsgs(session.messages.map(persistedToRuntime));
          setInitialSummary(session.summary);
        } else {
          // New or empty session — always reset so the previous session's
          // messages don't leak into the new chat.
          setInitialMsgs([]);
          setInitialSummary(undefined);
        }
        setLoadedSessionId(sessionId);
      })();
      return () => { cancelled = true; };
    } else {
      setSessionLoadError(null);
      if (!inNoSessionRef.current) {
        inNoSessionRef.current = true;
        setNoSessionEpoch(++noSessionEpochRef.current);
        newSessionRef.current = null;
        createdSessionIdRef.current = null;
      }
      // No sessionId — render a fresh empty chat without creating a
      // session.  A new session is created lazily when the user sends
      // their first message (see handleStreamComplete).
      setInitialMsgs([]);
      setInitialSummary(undefined);
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
    async (newMessages: ChatMessage[], summary?: ConversationSummary) => {
      try {
        if (newMessages.length < 2) return;
        const last = newMessages[newMessages.length - 1];
        const before = newMessages[newMessages.length - 2];
        const exchange = before.role === "user" ? [before, last] : [last];
        const persistedExchange = exchange.map(runtimeToPersisted);

        let targetId = sessionId ?? undefined;
        if (!targetId) {
          // Concurrent completions from a new chat must share one session.
          const sessionPromise = noSessionEpoch === noSessionEpochRef.current
            ? (newSessionRef.current ??= createNew().then((meta) => meta.id))
            : createNew().then((meta) => meta.id);
          try {
            targetId = await sessionPromise;
          } catch (error) {
            if (newSessionRef.current === sessionPromise) newSessionRef.current = null;
            throw error;
          }
        }

        if (summary) await appendMessages(targetId, persistedExchange, summary, secrets);
        else await appendMessages(targetId, persistedExchange, undefined, secrets);
        if (mountedRef.current) setSaveError(null);
        const msgCount = newMessages.length;

        if (!sessionId && mountedRef.current && currentSessionIdRef.current == null && noSessionEpoch === noSessionEpochRef.current) {
          createdSessionIdRef.current = targetId;
          navigate(`/assistant/${targetId}`, { replace: true });
        }
        if (mountedRef.current) await refresh().catch(() => {});
        if (sessionId) {
          notifySessionUpdate(targetId);
        }

        // Title generation must not hold up navigation or the next send.
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
            const titleSessionId = targetId;
            void generateTitle(config, userContent, assistantText)
              .then(async (title) => {
                if (title) await renameSession(titleSessionId, title, secrets);
                if (mountedRef.current) await refresh();
              })
              .catch((error) => console.error("Failed to name chat session:", redactSecrets(String(error), secrets)));
          }
        }
      } catch (err) {
        if (mountedRef.current) setSaveError(redactSecrets((err as Error).message ?? String(err), secrets));
      }
    },
    [sessionId, noSessionEpoch, navigate, refresh, config, createNew],
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
      try {
        await remove(id);
        setDeleteError(null);
        // If the deleted session is the currently active one, navigate
        // back to the no-session state so the chat area resets to the
        // welcome/empty panel instead of showing stale messages.
        if (id === sessionId) {
          navigate(`/assistant`, { replace: true });
        }
      } catch (error) {
        setDeleteError(redactSecrets((error as Error).message ?? String(error), secrets));
      }
    },
    [remove, sessionId, navigate, secrets],
  );

  return (
    <div
      className="relative flex h-[calc(100vh-88px)] overflow-hidden"
      data-testid="chat-session-layout"
    >
      {deleteError && (
        <p role="alert" className="absolute right-4 top-4 z-10 rounded bg-card px-4 py-2 text-sm text-destructive">
          {t("assistant.chat.deleteFailed")}: {deleteError}
        </p>
      )}
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
     {sessionLoadError ? (
       <div role="alert" className="flex-1 p-6 text-sm text-destructive">
         {t("assistant.chat.sessionLoadFailed")}: {sessionLoadError}
       </div>
     ) : sessionId && loadedSessionId !== sessionId && createdSessionIdRef.current !== sessionId ? (
       <div className="flex-1 p-6"><Skeleton className="h-24 w-full" /></div>
     ) : <ChatContent
       sessionId={sessionId ?? null}
       config={config}
       baseCurrency={baseCurrency}
       initialMessages={initialMsgs}
       initialSummary={initialSummary}
       onStreamComplete={handleStreamComplete}
       saveError={saveError}
        onStreamingChange={handleStreamingChange}
       sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
     />}
    </div>
  );
}

function ChatContent({
  config,
  baseCurrency,
  sessionId,
  initialMessages,
  initialSummary,
  onStreamComplete,
  saveError,
  onStreamingChange,
  sidebarOpen,
  onToggleSidebar,
}: {
  config: AIConfig;
  baseCurrency: CurrencyRateDetail;
  sessionId?: string | null;
  initialMessages: ChatMessage[];
  initialSummary?: ConversationSummary;
  onStreamComplete?: (messages: ChatMessage[], summary?: ConversationSummary) => void;
  saveError?: string | null;
  onStreamingChange?: (streaming: boolean) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { t } = useTranslation();
  const chat = useChat({
    config,
    baseCurrency,
    contextSize: config.contextSize,
    sessionId,
    initialMessages,
    initialSummary,
    onStreamComplete,
    onStreamingChange,
  });
  useEffect(() => {
    try {
      if (!sessionId) {
        const pending = takePendingAssistantQuestion();
        if (pending) {
          if ("page" in pending) {
            void chat.send(pending.question, t("aiSetup.modelContext")
              .replace("{page}", t(`aiSetup.page.${pending.page}`))
              .replace("{summary}", pending.summary));
          } else {
            chat.setInput(pending.question);
          }
          return;
        }
      }
      const question = sessionStorage.getItem(INSIGHT_QUESTION_STORAGE_KEY);
      if (question) {
        sessionStorage.removeItem(INSIGHT_QUESTION_STORAGE_KEY);
        chat.setInput(question);
      }
    } catch {
      // Assistant remains usable when session storage is unavailable.
    }
  }, [chat.setInput, chat.send, sessionId, t]);

  return (
    <Card
      data-testid="chat-card"
      className="flex min-w-0 flex-1 flex-col overflow-hidden"
    >
      <ChatHeader config={config} contextTokens={chat.contextTokens} sessionUsage={chat.sessionUsage} sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} />
      {saveError && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {t("assistant.chat.saveFailed")}: {saveError}
        </p>
      )}
      <ChatThread
        messages={chat.messages}
        isStreaming={chat.isStreaming}
        pricePerMillionTokens={config.pricePerMillionTokens}
        inputPricePerMillionTokens={config.inputPricePerMillionTokens}
        outputPricePerMillionTokens={config.outputPricePerMillionTokens}
        onPickPrompt={(text) => void chat.send(text)}
        currency={baseCurrency}
        onDecideAction={(id, decision) => void chat.decideAction(id, decision)}
        canDecideAction={!!sessionId && config.allowActions !== false && !chat.isStreaming && !saveError}
      />
      {chat.messages.length > 0 && (
        <QuickActions
          disabled={chat.isStreaming}
          onRun={(key) => {
            const k = key as keyof typeof QUICK_ACTION_KEYS;
            void chat.runQuickAction(k, quickActionPrompt(QUICK_ACTION_KEYS[k], t));
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

function ChatHeader({
  config, contextTokens, sessionUsage, sidebarOpen, onToggleSidebar,
}: {
  config: AIConfig;
  contextTokens: number;
  sessionUsage: import("@/middlelayers/ai/budget").TokenUsage;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { t } = useTranslation();
  const percent = Math.min(100, Math.round(contextTokens / config.contextSize * 100));
  return (
    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-[var(--glass-border)] bg-card/40 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarOpen ? t("ai.session.hide") : t("ai.session.show")}
          className="inline-flex touch:h-11 touch:w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring h-8 w-8"
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
      <div className="ml-auto flex shrink-0 flex-col items-end gap-0.5">
        {contextTokens > 0 && (
          <span role="progressbar" aria-label={t("assistant.usage.context").replace("{percent}", String(percent))}
            aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}
            className="text-[11px] text-muted-foreground">
            {t("assistant.usage.context").replace("{percent}", String(percent))}
          </span>
        )}
        {(sessionUsage.promptTokens > 0 || sessionUsage.completionTokens > 0) && (
          <UsageLabel usage={sessionUsage} pricePerMillionTokens={config.pricePerMillionTokens} inputPricePerMillionTokens={config.inputPricePerMillionTokens} outputPricePerMillionTokens={config.outputPricePerMillionTokens} />
        )}
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
