import {
  Chart as ChartJS,
  registerables,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import RefreshData from "@/mobile/components/refresh-data";
import ChartDataLabels from "chartjs-plugin-datalabels";
import PageWrapper from "@/mobile/components/page-wrapper";
import DatePicker from "@/mobile/components/date-picker";
import RealTimeTotalValue from "@/components/realtime-total-value";
import { AnimatedPage } from "@/components/motion";
import FirstRunOnboarding from "@/components/onboarding";
import PageLoadingOverlay from "@/mobile/components/page-loading-overlay";
import AutoBackupIndicator from "@/mobile/components/auto-backup-indicator";
import SyncStatusIndicator from "@/mobile/components/sync-status-indicator";
import { Route, Routes, HashRouter, Outlet, Navigate, useLocation, useNavigate, useOutletContext } from "react-router-dom";

import { CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  getAvailableDates,
  queryLastRefreshAt,
  getDataFingerprint,
} from "@/middlelayers/charts";
import {
  queryPreferCurrency,
  getLicenseIfIsPro,
  getInitialQueryDateRange,
  getQuoteColor,
  getDefaultCurrencyRate,
  getConfiguration,
} from "@/middlelayers/configuration";
import React from "react";
import { Progress } from "@/components/ui/progress";
import {
  autoBackupHistoricalData,
  autoImportHistoricalData,
} from "@/middlelayers/data";
import { DateRange } from "react-day-picker";
import { format, isValid, parseISO } from "date-fns";
import { invalidateCacheGroups } from "@/middlelayers/datafetch/utils/cache";
import { CACHE_GROUP_KEYS } from "@/middlelayers/consts";
import { APP_SOFT_REFRESH_EVENT } from "@/utils/hook";
import { ASSISTANT_APP_ACTION_EVENT, CURRENT_DATE_RANGE_KEY, DATE_RANGE_KEY, validateActionArgs } from "@/middlelayers/ai/actions";
import { useTranslation } from "@/mobile/i18n";
import { DataChangedContext } from "@/contexts/data-changed";
import { processAlerts } from "@/middlelayers/alerts";
import { deliverAlerts, formatAlert } from "@/middlelayers/alert-notifications";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { toast } from "@/mobile/components/ui/use-toast";
import { ToastAction } from "@/mobile/components/ui/toast";
import { markIOSReady } from "@/utils/ios-ready";
import { BottomSheet, Button as MobileButton, InsetGroup, ListRow, MobilePage, PullToRefresh, SplitView, useHaptics, useIsMobile, useSizeClass } from "@/mobile/components/mobile";
import TopCoinsRank from "@/mobile/components/top-coins-rank";
import ProfitSummary from "@/mobile/components/profit-summary";
import LatestAssetsPercentage from "@/mobile/components/latest-assets-percentage";
import AssetsPercentageChange from "@/mobile/components/assets-percentage-change";
import { MobileNavigation, MobileSidebar, routeTitle, tabForPath, tabRoots, type MobileTab } from "@/mobile/components/mobile/navigation";
import { MobileIcon, type MobileIconName } from "@/mobile/components/mobile/icons";
import { useAlertBadge } from "@/mobile/components/use-alert-badge";
import { MobileHeaderTotal } from "@/mobile/components/mobile/header-total";
import { ChevronLeftIcon } from "@radix-ui/react-icons";

const Setting = React.lazy(() => import("@/mobile/components/settings"));
const HistoricalData = React.lazy(() => import("@/mobile/components/historical-data"));
const Overview = React.lazy(() => import("@/mobile/components/overview"));
const Comparison = React.lazy(() => import("@/mobile/components/comparison"));
const Rebalance = React.lazy(() => import("@/mobile/components/rebalance"));
const GoalsAlerts = React.lazy(() => import("@/mobile/components/goals-alerts"));
const WalletAnalysis = React.lazy(() => import("@/mobile/components/wallet-analytics"));
const CoinAnalysis = React.lazy(() => import("@/mobile/components/coin-analytics"));
const Configuration = React.lazy(() => import("@/mobile/components/configuration"));
const DataManagement = React.lazy(() => import("@/mobile/components/data-management"));
const SystemInfo = React.lazy(() => import("@/mobile/components/system-info"));
const ChatPage = React.lazy(() => import("@/mobile/components/assistant/chat-page"));
const AssistantSettings = React.lazy(
  () => import("@/mobile/components/settings/assistant"),
);
const SyncSettingsPage = React.lazy(() => import("@/mobile/components/settings/sync"));
const Summary = React.lazy(() => import("@/mobile/components/summary"));
const Appearance = React.lazy(() => import("@/mobile/components/appearance"));
const CostBasis = React.lazy(() => import("@/mobile/components/cost-basis"));

ChartJS.register(
  ...registerables,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  ChartDataLabels,
);

export const RefreshButtonLoadingContext = React.createContext<{
  buttonLoading: boolean;
  setButtonLoading: React.Dispatch<React.SetStateAction<boolean>>;
  progress: number;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  refreshAction: React.MutableRefObject<(() => Promise<void>) | null>;
}>(null as any);

function TopBar({
  mobile,
  isProUser,
  quoteColor,
  currentCurrency,
  availableDates,
  dateRange,
  onDatePickerValueChange,
  lastRefreshAt,
  onRefreshSuccess,
  compactTitle,
  refreshAction,
  onBack,
  overview,
}: {
  mobile: boolean;
  isProUser: boolean;
  quoteColor: QuoteColor;
  currentCurrency: CurrencyRateDetail;
  availableDates: Date[];
  dateRange: DateRange | undefined;
  onDatePickerValueChange: (
    selectedTimes: number,
    nextDateRange: DateRange | undefined,
  ) => void;
  lastRefreshAt?: string;
  onRefreshSuccess: () => void;
  compactTitle?: string;
  refreshAction: React.MutableRefObject<(() => Promise<void>) | null>;
  onBack?: () => void;
  overview: boolean;
}) {
  const { t } = useTranslation();
  const [refreshButtonLoading, setRefreshButtonLoading] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [configuredSource, setConfiguredSource] = useState(false);
  useEffect(() => {
    if (!mobile || !overview || availableDates.length > 0) return;
    let active = true;
    void getConfiguration().then((config) => {
      if (!active) return;
      const chains = ["erc20", "sol", "btc", "doge", "trc20", "ton", "sui"] as const;
      setConfiguredSource(Boolean(
        config?.others?.length || config?.exchanges?.some((exchange) => exchange.active !== false) ||
        config?.stockConfig?.brokers?.some((broker) => broker.active !== false) ||
        chains.some((chain) => config?.[chain]?.addresses?.some((address) =>
          typeof address === "string" || address.active !== false)),
      ));
    }).catch(() => { if (active) setConfiguredSource(false); });
    return () => { active = false; };
  }, [mobile, overview, availableDates.length]);
  const showActions = !mobile || (overview && (availableDates.length > 0 || configuredSource));

  return (
    <div id="app-top-bar" className={`sticky top-0 z-10 glass-subtle border-b relative${mobile ? ` mobile-topbar ${onBack ? " mobile-topbar-back" : " mobile-topbar-root"}${compactTitle && !onBack ? " mobile-topbar-collapsed" : ""}` : ""}`}>
      <div className="flex h-12 items-center px-4">
        {mobile && onBack && <button type="button" className="mobile-back mobile-header-back"
          onClick={onBack} aria-label={t("common.back", "Back")}>
          <ChevronLeftIcon aria-hidden="true" />{t("common.back", "Back")}
        </button>}
        {compactTitle && <span className={`mobile-compact-title${overview ? " mobile-overview-compact-title" : ""}`}>{compactTitle}</span>}
        {(!mobile || compactTitle) && !(mobile && onBack && compactTitle) &&
          <MobileHeaderTotal currency={currentCurrency} live={isProUser}
            range={overview && dateRange?.from && dateRange.to ? { start: dateRange.from, end: dateRange.to } : undefined} />}
        {isProUser && !mobile && (
          <div className="mr-4">
            <RealTimeTotalValue
              quoteColor={quoteColor}
              currency={currentCurrency}
            />
          </div>
        )}
        <div className="ml-auto flex items-center space-x-3">
          {(!mobile || (overview && availableDates.length > 0)) && <DatePicker
            availableDates={availableDates}
            value={dateRange}
            onDateChange={onDatePickerValueChange}
          />}
          {showActions && <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <RefreshButtonLoadingContext.Provider
                    value={{
                      buttonLoading: refreshButtonLoading,
                      setButtonLoading: setRefreshButtonLoading,
                      progress: refreshProgress,
                      setProgress: setRefreshProgress,
                      refreshAction,
                    }}
                  >
                    <RefreshData
                      loading={refreshButtonLoading}
                      afterRefresh={(success) => {
                        if (success) {
                          onRefreshSuccess();
                        }
                      }}
                    />
                  </RefreshButtonLoadingContext.Provider>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {lastRefreshAt
                    ? t("topbar.lastRefreshAt") + lastRefreshAt
                    : t("topbar.neverRefreshBefore")}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>}
        </div>
      </div>
      {refreshProgress > 0 && refreshButtonLoading && (
        <div className="absolute left-0 right-0 top-full z-20 flex items-center justify-center pt-1 pointer-events-none">
          <Progress value={refreshProgress} className="w-[80%]" />
        </div>
      )}
    </div>
  );
}

function RouteLoadingFallback({ hidden }: { hidden: boolean }) {
  const { t } = useTranslation();
  if (hidden) {
    return null;
  }

  return (
    <PageLoadingOverlay
      title={t("loading.route")}
      description={t("loading.routeDesc")}
    />
  );
}

type LayoutProps = {
  initializing: boolean;
  loadFailed: boolean;
  onRetryDataLoad: () => void;
  isProUser: boolean;
  quoteColor: QuoteColor;
  currentCurrency: CurrencyRateDetail;
  availableDates: Date[];
  dateRange: DateRange | undefined;
  onDatePickerValueChange: (
    selectedTimes: number,
    nextDateRange: DateRange | undefined,
  ) => void;
  lastRefreshAt?: string;
  onRefreshSuccess: () => void;
  onLocalRefresh: () => Promise<void>;
  onRootTap: (tab: MobileTab) => void;
};

function Layout({
  initializing,
  loadFailed,
  onRetryDataLoad,
  isProUser,
  quoteColor,
  currentCurrency,
  availableDates,
  dateRange,
  onDatePickerValueChange,
  lastRefreshAt,
  onRefreshSuccess,
  onLocalRefresh,
  onRootTap,
}: LayoutProps) {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  const sizeClass = useSizeClass();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.innerWidth >= 700 && window.innerHeight < 500,
  );
  const unread = useAlertBadge();
  const location = useLocation();
  const navigate = useNavigate();
  const currentTab = tabForPath(location.pathname);
  const routePath = location.pathname + location.search + location.hash;
  const rootPath = tabRoots[currentTab];
  const tabStacks = useRef<Record<"overview" | "history" | "analytics" | "more", string[]>>({
    overview: [tabRoots.overview], history: [tabRoots.history],
    analytics: [tabRoots.analytics], more: [tabRoots.more],
  });
  const stack = tabStacks.current[currentTab];
  if (stack.at(-1) !== routePath) {
    const existing = stack.indexOf(routePath);
    if (existing >= 0) stack.splice(existing + 1);
    else stack.push(routePath);
  }
  const routeParents = useRef(new Map<string, string>());
  const previousRoute = useRef({ tab: currentTab, path: routePath });
  const backPath = routeParents.current.get(routePath) ?? stack.at(-2) ?? rootPath;
  const canGoBack = routePath !== rootPath;
  const showBack = canGoBack && !(sizeClass.width === "wide" &&
    /^\/(settings|assistant|goals|rebalance)(\/|$)/.test(location.pathname));
  const routeScroll = useRef(new Map<string, number>());
  const containerScroll = useRef(new Map<string, number[]>());
  const scrollKey = (tab: string, path: string) => `${tab}:${path}`;
  const scrollContainers = () => Array.from(document.querySelectorAll<HTMLElement>(
    "#app-main-content .ios-d3-chat [data-radix-scroll-area-viewport]",
  ));
  const resetRootScroll = useRef<string | null>(null);
  const scrollCaptured = useRef(false);
  const rememberScroll = () => {
    const key = scrollKey(currentTab, routePath);
    routeScroll.current.set(key, window.scrollY);
    containerScroll.current.set(key, scrollContainers().map((element) => element.scrollTop));
    scrollCaptured.current = true;
  };
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const refreshAction = useRef<(() => Promise<void>) | null>(null);
  useLayoutEffect(() => {
    const previous = previousRoute.current;
    if (previous.tab === currentTab && previous.path === routePath) return;
    if (!scrollCaptured.current) routeScroll.current.set(scrollKey(previous.tab, previous.path), window.scrollY);
    scrollCaptured.current = false;
    const key = scrollKey(currentTab, routePath);
    const target = resetRootScroll.current === key ? 0 : routeScroll.current.get(key) ?? 0;
    const containers = containerScroll.current.get(key) ?? [];
    resetRootScroll.current = null;
    const restore = () => {
      window.scrollTo({ top: target, behavior: "auto" });
      const elements = scrollContainers();
      elements.forEach((element, index) => { element.scrollTop = containers[index] ?? 0; });
      return Math.abs(window.scrollY - target) < 2 && containers.every((value, index) =>
        Math.abs((elements[index]?.scrollTop ?? -1) - value) < 2);
    };
    restore();
    const main = document.getElementById("app-main-content");
    const observer = (target > 0 || containers.some((value) => value > 0)) && main && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
        if (restore()) observer?.disconnect();
      }) : null;
    if (main && observer) observer.observe(main);
    const stopRestoring = () => observer?.disconnect();
    window.addEventListener("touchstart", stopRestoring, { once: true, passive: true });
    previousRoute.current = { tab: currentTab, path: routePath };
    return () => {
      observer?.disconnect();
      window.removeEventListener("touchstart", stopRestoring);
    };
  }, [currentTab, routePath]);
  useEffect(() => {
    const update = () => setHeaderCollapsed(window.scrollY > 64);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [location.pathname]);
  useEffect(() => {
    if (sizeClass.width !== "compact" && sizeClass.height === "compact") {
      setSidebarCollapsed(true);
    }
  }, [sizeClass.width, sizeClass.height]);
  const onTabSwitch = (rootTap: boolean) => {
    if (!rootTap || routePath !== rootPath) rememberScroll();
    else scrollCaptured.current = false;
    if (rootTap) {
      const rootKey = scrollKey(currentTab, tabRoots[currentTab]);
      resetRootScroll.current = routePath === rootPath ? null : rootKey;
      routeScroll.current.set(rootKey, 0);
      onRootTap(currentTab);
    }
  };

  return (
    <div className="app-layout min-h-screen" data-width-class={sizeClass.width}
      data-height-class={sizeClass.height} data-sidebar-collapsed={sidebarCollapsed}>
      <MobileSidebar unread={unread} collapsed={sidebarCollapsed} onCollapse={() => setSidebarCollapsed((value) => !value)}
        onTabSwitch={onTabSwitch} />
      <div
        className="app-content transition-[margin-left] duration-300 ease-in-out"
      >
        <TopBar
          mobile={mobile}
          isProUser={isProUser}
          quoteColor={quoteColor}
          currentCurrency={currentCurrency}
          availableDates={availableDates}
          dateRange={dateRange}
          onDatePickerValueChange={onDatePickerValueChange}
          lastRefreshAt={lastRefreshAt}
          compactTitle={mobile && headerCollapsed ? routeTitle(location.pathname, t) : undefined}
          overview={location.pathname === "/overview"}
          onBack={showBack ? () => { rememberScroll(); navigate(backPath); } : undefined}
          onRefreshSuccess={onRefreshSuccess}
          refreshAction={refreshAction}
        />

        {/* Main content */}
        <main id="app-main-content" tabIndex={-1} className="p-5"
          onContextMenuCapture={(event) => {
            if ((event.target as Element).closest("canvas")) event.preventDefault();
          }}
          onClickCapture={(event) => {
            const link = (event.target as Element).closest('a[href^="#/"]');
            if (!link) return;
            rememberScroll();
            routeParents.current.set(link.getAttribute("href")!.slice(1), routePath);
          }}
          onPointerDown={(event) => {
            if (event.pointerType !== "touch") return;
            swipeStart.current = event.clientX < event.currentTarget.getBoundingClientRect().left + 24 &&
              !(event.target as Element).closest('[aria-modal="true"]')
              ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
          }}
          onPointerUp={(event) => {
            const start = swipeStart.current;
            swipeStart.current = null;
            if (!showBack || !start || event.pointerId !== start.id) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (dx > 90 && Math.abs(dx) > Math.abs(dy)) {
              rememberScroll();
              navigate(backPath);
            }
          }}
          onPointerCancel={() => { swipeStart.current = null; }}>
          <PullToRefresh disabled={/^\/assistant(\/|$)/.test(location.pathname)} onRefresh={onLocalRefresh}>
          {!/^\/(settings|goals|rebalance)(\/|$)/.test(location.pathname) && <div className="mobile-route-heading">
            <MobilePage title={routeTitle(location.pathname, t)} />
          </div>}
          <div className="relative min-h-[400px] min-w-0" aria-busy={initializing}>
            {mobile && loadFailed && /^\/(overview|history|summary|wallets|comparison|cost-basis|coins)(\/|$)/.test(location.pathname) ? <div className="mobile-empty-state mobile-data-error" role="alert">
              <svg viewBox="0 0 112 112" fill="none" aria-hidden="true">
                <circle cx="56" cy="56" r="48" fill="currentColor" opacity=".08" />
                <circle cx="56" cy="56" r="33" stroke="currentColor" strokeWidth="2.5" />
                <path d="M56 36v27M56 76h.1" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
              <h2>{t("app.dataLoadFailed")}</h2>
              <p>{t("app.dataLoadFailedDescription")}</p>
              <MobileButton onClick={onRetryDataLoad}>{t("app.retryDataLoad")}</MobileButton>
            </div> : <>
            <React.Suspense
              fallback={<RouteLoadingFallback hidden={initializing} />}
            >
              <Outlet context={unread} />
            </React.Suspense>
            </>}
            {initializing && (
              <PageLoadingOverlay
                title={t("loading.portfolio")}
                description={t("loading.portfolioDesc")}
              />
            )}
          </div>
          </PullToRefresh>
        </main>
      </div>
      <MobileNavigation unread={unread} onTabSwitch={onTabSwitch} />
    </div>
  );
}

function MoreHub({ children }: React.PropsWithChildren) {
  const { t } = useTranslation();
  const haptic = useHaptics();
  const unread = useOutletContext<number>();
  const pathname = useLocation().pathname;
  const items: { href: string; label: string; value?: string; icon: MobileIconName }[] = [
    { href: "#/rebalance", label: t("nav.rebalance"), icon: "rebalance" },
    { href: "#/goals", label: t("nav.goals"), value: unread > 0 ? String(unread) : undefined, icon: "goals" },
    { href: "#/assistant", label: t("nav.assistant"), icon: "assistant" },
    { href: "#/settings", label: t("nav.settings"), icon: "settings" },
  ];
  const master = <div className="mobile-more-hub ios-d3-more" onClickCapture={() => haptic("selection")}>
    <InsetGroup title={t("more.group.plan")}>
      {items.slice(0, 2).map((item) => <ListRow key={item.href} href={item.href} value={item.value}
        ariaCurrent={pathname === item.href.slice(1) ? "page" : undefined}>
        <MobileIcon name={item.icon} />{item.label}
      </ListRow>)}
    </InsetGroup>
    <InsetGroup title={t("more.group.manage")}>
      {items.slice(2).map((item) => <ListRow key={item.href} href={item.href} value={item.value}
        ariaCurrent={pathname === item.href.slice(1) || (item.href === "#/assistant" && pathname.startsWith("/assistant/"))
          || (item.href === "#/settings" && pathname.startsWith("/settings/")) ? "page" : undefined}>
        <MobileIcon name={item.icon} />{item.label}
      </ListRow>)}
    </InsetGroup>
  </div>;
  return <SplitView selected={Boolean(children)} className={`more-split${/^\/(settings|assistant)(\/|$)/.test(pathname) ? " more-detail-only" : ""}`}
    masterLabel={t("nav.more")} detailLabel={t("nav.more")}
    master={master} detail={children ?? <p className="analytics-empty">{t("more.selectDetail")}</p>} />;
}

function AnalyticsHub({ currency, dateRange, quoteColor }: {
  currency: CurrencyRateDetail; dateRange: { start: Date; end: Date }; quoteColor: QuoteColor;
}) {
  const { t } = useTranslation();
  const isWide = useSizeClass().width === "wide";
  const [sheet, setSheet] = useState<"allocation" | "rank" | "profit" | "positions" | null>(null);
  const items: { label: string; detail: string; icon: "allocation" | "rank" | "wallets" | "comparison" | "profit" | "positions" | "cost"; href?: string; sheet?: "allocation" | "rank" | "profit" | "positions" }[] = [
    { sheet: "allocation", label: t("overview.allocation"), detail: t("analytics.allocationDetail"), icon: "allocation" },
    { sheet: "rank", label: t("analytics.rank"), detail: t("analytics.rankDetail"), icon: "rank" },
    { href: "#/wallets", label: t("nav.wallets"), detail: t("analytics.walletsDetail"), icon: "wallets" },
    { href: "#/comparison", label: t("nav.comparison"), detail: t("analytics.comparisonDetail"), icon: "comparison" },
    { sheet: "profit", label: t("analytics.profit"), detail: t("analytics.profitDetail"), icon: "profit" },
    { sheet: "positions", label: t("analytics.positionChanges"), detail: t("analytics.positionChangesDetail"), icon: "positions" },
    { href: "#/cost-basis", label: t("nav.costBasis"), detail: t("analytics.costDetail"), icon: "cost" },
  ];
  return <div className="mobile-analytics-hub" data-open-sheet={sheet ?? undefined}>
    <SplitView selected={false} className="analytics-split"
      masterLabel={t("nav.analytics")} detailLabel={t("nav.analytics")}
      master={<div className="analytics-tile-grid">
      {items.map((item) => {
        const content = <><span className="analytics-tile-icon"><AnalyticsTileIcon name={item.icon} /></span>
          <strong>{item.label}</strong><small>{item.detail}</small></>;
        return item.href
          ? <a className="analytics-tile" key={item.label} href={item.href}>{content}</a>
          : <button className="analytics-tile" type="button" key={item.label}
            aria-current={isWide && sheet === item.sheet ? "true" : undefined}
            onClick={() => setSheet(item.sheet!)}>{content}</button>;
      })}
    </div>}
      detail={sheet === null && isWide
        ? <div className="mobile-inline-detail analytics-empty">{t("analytics.selectDetail")}</div>
        : <BottomSheet open={sheet !== null} onOpenChange={(open) => { if (!open) setSheet(null); }}
      title={sheet === "allocation" ? t("overview.allocation")
        : sheet === "rank" ? t("analytics.rank")
        : sheet === "positions" ? t("analytics.positionChanges") : t("analytics.profit")}
      detents={["large"]} initialDetent="large" inline={isWide}>
      {sheet === "allocation" && <div className="d2-allocation-sheet"><LatestAssetsPercentage dateRange={dateRange} currency={currency} /></div>}
      {sheet === "rank" && <div className="d2-rank-sheet"><TopCoinsRank dateRange={dateRange} currency={currency} /></div>}
      {sheet === "profit" && <div className="d2-profit-sheet"><ProfitSummary dateRange={dateRange} currency={currency} quoteColor={quoteColor} /></div>}
      {sheet === "positions" && <div className="d2-positions-sheet"><AssetsPercentageChange dateRange={dateRange} /></div>}
    </BottomSheet>} />
  </div>;
}

function AnalyticsTileIcon({ name }: { name: "allocation" | "rank" | "wallets" | "comparison" | "profit" | "positions" | "cost" }) {
  const paths = {
    allocation: <><circle cx="12" cy="12" r="8" /><path d="M12 4v8l6.5 4.5" /></>,
    rank: <><path d="M4 20h16M6 16h3v4H6zM11 11h3v9h-3zM16 6h3v14h-3z" /></>,
    wallets: <><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 9V6a2 2 0 0 1 2-2h13M15 13h6" /></>,
    comparison: <><path d="M4 6h14M4 11h9M4 16h12M18 4l3 2-3 2M16 14l3 2-3 2" /></>,
    profit: <><path d="M4 18l5-6 4 3 7-9M15 6h5v5" /></>,
    positions: <><path d="M4 18V9M9 18V5M14 18v-7M19 18V7M3 20h18" /></>,
    cost: <><path d="M7 4h10l3 3v13H4V4h3zM8 10h8M8 14h8M8 18h5" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

type AppRoutesProps = {
  initializing: boolean;
  loadFailed: boolean;
  onRetryDataLoad: () => void;
  isProUser: boolean;
  setIsProUser: React.Dispatch<React.SetStateAction<boolean>>;
  quoteColor: QuoteColor;
  setQuoteColor: React.Dispatch<React.SetStateAction<QuoteColor>>;
  currentCurrency: CurrencyRateDetail;
  availableDates: Date[];
  dateRange: DateRange | undefined;
  tDateRange: { start: Date; end: Date };
  maxDateRange: { start: Date; end: Date };
  hasData: boolean;
  retainHistory: boolean;
  setRetainHistory: React.Dispatch<React.SetStateAction<boolean>>;
  onDatePickerValueChange: (
    selectedTimes: number,
    nextDateRange: DateRange | undefined,
  ) => void;
  lastRefreshAt?: string;
  onDataChanged: () => void;
  onLocalRefresh: () => Promise<void>;
  handleConfigurationSave: () => void;
};

function AppRoutes({
  initializing,
  loadFailed,
  onRetryDataLoad,
  isProUser,
  setIsProUser,
  quoteColor,
  setQuoteColor,
  currentCurrency,
  availableDates,
  dateRange,
  tDateRange,
  maxDateRange,
  hasData,
  retainHistory,
  setRetainHistory,
  onDatePickerValueChange,
  lastRefreshAt,
  onDataChanged,
  onLocalRefresh,
  handleConfigurationSave,
}: AppRoutesProps) {
  const location = useLocation();
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  useEffect(() => {
    if (location.pathname !== "/history") {
      setRetainHistory(false);
    }
  }, [location.pathname, setRetainHistory]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout
            initializing={initializing}
            loadFailed={loadFailed}
            onRetryDataLoad={onRetryDataLoad}
            isProUser={isProUser}
            quoteColor={quoteColor}
            currentCurrency={currentCurrency}
            availableDates={availableDates}
            dateRange={dateRange}
            onDatePickerValueChange={onDatePickerValueChange}
            lastRefreshAt={lastRefreshAt}
            onRefreshSuccess={() => {
              onDataChanged();
              syncRuntime.trigger("refresh");
            }}
            onLocalRefresh={onLocalRefresh}
            onRootTap={(tab) => {
              if (tab === "overview") setOverviewExpanded(false);
            }}
          />
        }
      >
        <Route index element={<Navigate to="/overview" />} />
        <Route path="more" element={<MoreHub />} />
        <Route
          path="overview"
          element={
            <AnimatedPage>
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <Overview
                  currency={currentCurrency}
                  dateRange={tDateRange}
                  quoteColor={quoteColor}
                  expanded={overviewExpanded}
                  onExpandedChange={setOverviewExpanded}
                />
              </PageWrapper>
            </AnimatedPage>
          }
        />
        <Route
          path="summary"
          element={
            <AnimatedPage>
              <PageWrapper dateRange={maxDateRange} hasData={hasData}>
                <AnalyticsHub currency={currentCurrency} dateRange={maxDateRange} quoteColor={quoteColor} />
                <Summary
                  currency={currentCurrency}
                  dateRange={maxDateRange}
                  quoteColor={quoteColor}
                />
              </PageWrapper>
            </AnimatedPage>
          }
        />
        <Route
          path="wallets"
          element={
            <AnimatedPage>
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <WalletAnalysis
                  currency={currentCurrency}
                  dateRange={tDateRange}
                  quoteColor={quoteColor}
                />
              </PageWrapper>
            </AnimatedPage>
          }
        />
        <Route
          path="comparison"
          element={
            <AnimatedPage>
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <Comparison
                  currency={currentCurrency}
                  quoteColor={quoteColor}
                />
              </PageWrapper>
            </AnimatedPage>
          }
        />
        <Route
          path="rebalance"
          element={
            <MoreHub><AnimatedPage>
              <Rebalance currency={currentCurrency} quoteColor={quoteColor} />
            </AnimatedPage></MoreHub>
          }
        />
        <Route path="goals" element={<MoreHub><AnimatedPage><GoalsAlerts /></AnimatedPage></MoreHub>} />
        <Route
          path="history"
          element={
            <AnimatedPage>
              <PageWrapper
                dateRange={tDateRange}
                hasData={hasData || retainHistory}
              >
                <HistoricalData
                  currency={currentCurrency}
                  dateRange={tDateRange}
                  quoteColor={quoteColor}
                  afterDataChanged={onDataChanged}
                />
              </PageWrapper>
            </AnimatedPage>
          }
        />
        <Route
          path="cost-basis"
          element={
            <AnimatedPage>
              <CostBasis quoteColor={quoteColor} />
            </AnimatedPage>
          }
        />
        <Route
          path="assistant"
          element={
            <MoreHub><AnimatedPage>
              <ChatPage isProUser={isProUser} />
            </AnimatedPage></MoreHub>
          }
        />
        <Route
          path="assistant/:sessionId"
          element={
            <MoreHub><AnimatedPage>
              <ChatPage isProUser={isProUser} />
            </AnimatedPage></MoreHub>
          }
        />
        <Route
          path="settings"
          element={
            <MoreHub><AnimatedPage>
              <Setting />
            </AnimatedPage></MoreHub>
          }
        >
          <Route
            path="configuration"
            element={
              <Configuration onConfigurationSave={handleConfigurationSave} />
            }
          />
          <Route
            path="appearance"
            element={
              <Appearance onQuoteColorChange={(v) => setQuoteColor(v)} />
            }
          />
          <Route
            path="data"
            element={<DataManagement onDataImported={onDataChanged} />}
          />
          <Route
            path="systemInfo"
            element={
              <SystemInfo
                onProStatusChange={(act: boolean) => {
                  setIsProUser(act);
                }}
              />
            }
          />
          <Route path="assistant" element={<AssistantSettings />} />
          <Route path="sync" element={<SyncSettingsPage />} />
        </Route>
        <Route
          path="coins/:symbol"
          element={
            <AnimatedPage>
              <CoinAnalysis
                currency={currentCurrency}
                dateRange={tDateRange}
                onDataChanged={onDataChanged}
              />
            </AnimatedPage>
          }
        />
        <Route path="*" element={<div>not found</div>} />
      </Route>
    </Routes>
  );
}

const App = () => {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  // todo: auto update this value, if user active or inactive
  const [isProUser, setIsProUser] = useState(false);
  const [quoteColor, setQuoteColor] = useState<QuoteColor>("green-up-red-down");

  const [availableDates, setAvailableDates] = useState<Date[]>([]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | undefined>(
    undefined,
  );
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyRateDetail>(
    getDefaultCurrencyRate(),
  );

  const [originalQuerySize, setOriginalQuerySize] = useState<number>(0);
  const [hasData, setHasData] = useState(true);
  const [retainHistory, setRetainHistory] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const retryLoad = useRef<(() => void) | null>(null);
  const [dataChangedVersion, setDataChangedVersion] = useState(0);
  const [autoBackupStatus, setAutoBackupStatus] = useState<
    "idle" | "running"
  >("idle");
  const lastSyncReport = useRef<object | undefined>(undefined);
  // Single mount guard reused by both boot and background effects.
  const activeRef = useRef(true);

  useEffect(() => {
    let active = true;

    const loadStartupData = () => Promise.all([
      queryPreferCurrency().then((c) => {
        if (active) setCurrentCurrency(c);
      }),
      getLicenseIfIsPro().then((l) => {
        if (active) setIsProUser(!!l);
      }),
      getQuoteColor().then((c) => {
        if (active) setQuoteColor(c);
      }),
    ]).then(() => loadAllData(active));

    const start = () => {
      if (!active) return;
      setLoadFailed(false);
      setInitializing(true);
      void loadStartupData()
        .then(() => {
          if (!active) return;
          void processAlerts().then((alerts) => deliverAlerts(alerts, (alert) => {
            const text = formatAlert(alert, t);
            toast({ title: text.title, description: text.message });
          }, t)).catch(() => {
            console.warn("startup alert evaluation failed");
          });
        })
        .catch(() => {
          if (!active) return;
          setLoadFailed(true);
          console.warn("startup data loading failed");
          if (!mobile) toast({
            title: t("app.dataLoadFailed"),
            duration: 86_400_000,
            action: <ToastAction altText={t("app.retryDataLoad")} onClick={start} className="touch:min-h-11">
              {t("app.retryDataLoad")}
            </ToastAction>,
          });
        })
        .finally(() => {
          if (active) {
            setInitializing(false);
            void markIOSReady().catch(() => {
              console.warn("iOS readiness check failed");
            });
            // Defer to the next tick so the boot overlay clears first;
            // auto backup is intentionally off the critical path.
            window.setTimeout(() => {
              void runAutoBackupInBackground();
            }, 0);
          }
        });
    };
    retryLoad.current = start;
    start();

    return () => {
      active = false;
      retryLoad.current = null;
    };
  }, []);

  useEffect(() => {
    void syncRuntime.initialize();
    const onFocus = () => syncRuntime.trigger("focus");
    const onQuit = () => syncRuntime.stop();
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeunload", onQuit);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeunload", onQuit);
      syncRuntime.stop();
    };
  }, []);

  useEffect(() => syncRuntime.subscribe(() => {
    const { sync } = syncRuntime.status();
    const report = sync.report;
    if (!report?.pulledFrom?.length || lastSyncReport.current === report) return;
    lastSyncReport.current = report;
    const names = [...new Set(report.pulledFrom ?? [])].map((id) =>
      syncRuntime.getSettings().deviceNames[id] ?? id.slice(0, 8));
    toast({ description: t("sync.pulledToast")
      .replace("{count}", String(report.pulledFrom.length))
      .replace("{device}", names.join(", ")) });
  }), [t]);

  const tDateRange = useMemo(
    () => ({
      start: dateRange?.from ?? parseISO("1970-01-01"),
      end: dateRange?.to ?? parseISO("1970-01-01"),
    }),
    [dateRange],
  );
  useEffect(() => {
    if (dateRange?.from && dateRange.to && isValid(dateRange.from) && isValid(dateRange.to)) {
      localStorage.setItem(CURRENT_DATE_RANGE_KEY, JSON.stringify({
        from: format(dateRange.from, "yyyy-MM-dd"), to: format(dateRange.to, "yyyy-MM-dd"),
      }));
    }
  }, [dateRange]);

  const maxDateRange = useMemo(
    () => ({
      start: availableDates[0] ?? parseISO("1970-01-01"),
      end: availableDates[availableDates.length - 1] ?? parseISO("1970-01-01"),
    }),
    [availableDates],
  );

  function loadConfiguration() {
    queryPreferCurrency().then((c) => setCurrentCurrency(c));
    getLicenseIfIsPro().then((l) => setIsProUser(!!l));
    getQuoteColor().then((c) => setQuoteColor(c));
  }

  useEffect(() => {
    const applyAssistantAction = () => {
      loadConfiguration();
      try {
        const raw = localStorage.getItem(DATE_RANGE_KEY);
        if (!raw) return;
        const dates = validateActionArgs("set_date_range", JSON.parse(raw));
        localStorage.removeItem(DATE_RANGE_KEY);
        setDateRange({ from: parseISO(String(dates.from)), to: parseISO(String(dates.to)) });
      } catch {
        localStorage.removeItem(DATE_RANGE_KEY);
      }
    };
    window.addEventListener(ASSISTANT_APP_ACTION_EVENT, applyAssistantAction);
    return () => window.removeEventListener(ASSISTANT_APP_ACTION_EVENT, applyAssistantAction);
  }, []);

  // Track unmount so the background backup never setState's a torn-down
  // component. activeRef is shared between boot + background effects.
  useEffect(() => {
    return () => {
      activeRef.current = false;
    };
  }, []);

  // Run auto import + auto backup in the background after the initial
  // render. The page-loading overlay has already cleared by the time we
  // get here, so this work no longer blocks "Loading portfolio data".
  //
  // Data-refresh policy: snapshot a fingerprint before import, then
  // compare after. Only refresh page data when the persisted state
  // actually changed — the no-op case (autoBackup returning false,
  // autoImport short-circuiting on already-current backup) must not
  // force a re-render of the user-facing data.
  async function runAutoBackupInBackground() {
    if (!activeRef.current) return;
    setAutoBackupStatus("running");

    try {
      const preFingerprint = await getDataFingerprint();
      const imported = await autoImportHistoricalData();
      if (!activeRef.current) return;

      if (imported) {
        const postFingerprint = await getDataFingerprint();
        if (postFingerprint !== preFingerprint) {
          // Data changed: refresh the page promptly so the user
          // sees the imported data without reloading manually.
          clearAllCache();
          await loadAllData(activeRef.current);
        }
      }
    } catch (e) {
      console.error("auto import failed");
    }

    try {
      // Backup writes to disk only; the in-memory data is unchanged so
      // no page refresh is needed.
      await autoBackupHistoricalData();
    } catch (e) {
      console.error("auto backup failed");
    } finally {
      if (activeRef.current) {
        setAutoBackupStatus("idle");
      }
    }
  }

  async function handleQuerySizeWhenConfigurationChange() {
    const { dr, size } = await getInitialQueryDateRange();
    if (size !== originalQuerySize) {
      setDateRange((prev) => {
        const prevFrom = prev?.from?.getTime() ?? 0;
        const prevTo = prev?.to?.getTime() ?? 0;
        const nextFrom = dr?.from?.getTime() ?? 0;
        const nextTo = dr?.to?.getTime() ?? 0;
        if (prevFrom === nextFrom && prevTo === nextTo) {
          return prev;
        }
        return dr;
      });
      setOriginalQuerySize(size);
    }
  }

  function onDataChanged(action?: "delete" | "undoDeletion") {
    const currentHash = window.location.hash || "";
    const isSettingsRoute = currentHash.startsWith("#/settings");
    setRetainHistory(action === "delete" || action === "undoDeletion");
    // Bump the data-changed version first so any consumer that subscribes
    // through DataChangedContext sees a new value during this same tick,
    // even when the settings route skips loadAllData() below.
    setDataChangedVersion((v) => v + 1);
    clearAllCache();
    if (!isSettingsRoute) {
      void loadAllData(
        true,
        action === "delete" || action === "undoDeletion",
      ).catch(() => {
        console.warn("data reload failed");
      });
    }
    void autoBackupHistoricalData(true).catch(() => {
      console.warn("forced auto backup failed");
    });
  }

  async function refreshLocalView() {
    clearAllCache();
    await Promise.all([loadAllData(true, true), queryPreferCurrency().then(setCurrentCurrency),
      getLicenseIfIsPro().then((license) => setIsProUser(!!license)), getQuoteColor().then(setQuoteColor)]);
    setDataChangedVersion((version) => version + 1);
  }

  const onDataChangedRef = useRef(onDataChanged);
  onDataChangedRef.current = onDataChanged;

  useEffect(() => {
    const handleSoftRefresh = () => {
      onDataChangedRef.current();
    };
    window.addEventListener(APP_SOFT_REFRESH_EVENT, handleSoftRefresh);
    return () => {
      window.removeEventListener(APP_SOFT_REFRESH_EVENT, handleSoftRefresh);
    };
  }, []);

  function clearAllCache() {
    console.debug("clear all cache");
    invalidateCacheGroups({
      localStorage: [CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY],
      memory: [CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY],
    });
  }

  function onDatePickerValueChange(
    _selectedTimes: number,
    nextDateRange: DateRange | undefined,
  ) {
    localStorage.removeItem(DATE_RANGE_KEY);
    setDateRange((prev) => {
      const prevFrom = prev?.from?.getTime() ?? 0;
      const prevTo = prev?.to?.getTime() ?? 0;
      const nextFrom = nextDateRange?.from?.getTime() ?? 0;
      const nextTo = nextDateRange?.to?.getTime() ?? 0;
      if (prevFrom === nextFrom && prevTo === nextTo) {
        return prev;
      }
      return nextDateRange;
    });
  }

  function loadAllData(active = true, preserveDateRange = false) {
    return Promise.all([
      queryLastRefreshAt(),
      getAvailableDates(),
      getInitialQueryDateRange(),
    ]).then(([lra, days, queryInfo]) => {
      if (!active) {
        return;
      }
      setLastRefreshAt((prev) => (prev === lra ? prev : lra));
      setHasData((prev) => {
        const nextHasData = !!lra;
        return prev === nextHasData ? prev : nextHasData;
      });
      setAvailableDates((prev) => (isSameDateList(prev, days) ? prev : days));

      const { dr, size } = queryInfo;
      if (!preserveDateRange) {
        let assistantDates: DateRange | undefined;
        try {
          const stored = localStorage.getItem(DATE_RANGE_KEY);
          if (stored) {
            const dates = validateActionArgs("set_date_range", JSON.parse(stored));
            assistantDates = { from: parseISO(String(dates.from)), to: parseISO(String(dates.to)) };
            localStorage.removeItem(DATE_RANGE_KEY);
          }
        } catch {
          localStorage.removeItem(DATE_RANGE_KEY);
        }
        setDateRange((prev) => {
          if (assistantDates) return assistantDates;
          const prevFrom = prev?.from?.getTime() ?? 0;
          const prevTo = prev?.to?.getTime() ?? 0;
          const nextFrom = dr?.from?.getTime() ?? 0;
          const nextTo = dr?.to?.getTime() ?? 0;
          if (prevFrom === nextFrom && prevTo === nextTo) {
            return prev;
          }
          return dr;
        });
      }
      setOriginalQuerySize((prev) => (prev === size ? prev : size));
    });
  }

  function isSameDateList(prev: Date[], next: Date[]) {
    if (prev.length !== next.length) {
      return false;
    }
    for (let i = 0; i < prev.length; i++) {
      if (prev[i]?.getTime() !== next[i]?.getTime()) {
        return false;
      }
    }
    return true;
  }

  const handleConfigurationSave = useCallback(() => {
    handleQuerySizeWhenConfigurationChange();
    loadConfiguration();
  }, [originalQuerySize]);

  return (
    <div>
      <AutoBackupIndicator status={autoBackupStatus} />
      <SyncStatusIndicator />
      <DataChangedContext.Provider value={dataChangedVersion}>
        <HashRouter>
          <FirstRunOnboarding variant="ios" ready={!initializing && !loadFailed} />
          <AppRoutes
          initializing={initializing}
          loadFailed={loadFailed}
          onRetryDataLoad={() => retryLoad.current?.()}
          isProUser={isProUser}
          setIsProUser={setIsProUser}
          quoteColor={quoteColor}
          setQuoteColor={setQuoteColor}
          currentCurrency={currentCurrency}
          availableDates={availableDates}
          dateRange={dateRange}
          tDateRange={tDateRange}
          maxDateRange={maxDateRange}
          hasData={hasData}
          retainHistory={retainHistory}
          setRetainHistory={setRetainHistory}
          onDatePickerValueChange={onDatePickerValueChange}
          lastRefreshAt={lastRefreshAt}
          onDataChanged={onDataChanged}
          onLocalRefresh={refreshLocalView}
          handleConfigurationSave={handleConfigurationSave}
        />
        </HashRouter>
      </DataChangedContext.Provider>
    </div>
  );
};

export default App;
