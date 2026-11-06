import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { BackpackIcon, OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { TDateRange } from "@/middlelayers/types";
import { parseISO } from "date-fns";
import { useTranslation } from "@/mobile/i18n";
import { useIsMobile, useSizeClass } from "@/mobile/components/mobile";
import { isIOS } from "@/utils/platform";
import EmptyState from "@/components/empty-state";

const emptyDate = parseISO("1970-01-01");

const App = ({
  hasData,
  children,
  dateRange,
  fidelityFirstRun = false,
  allowEmpty = false,
}: {
  hasData: boolean;
  children: React.ReactNode;
  dateRange: TDateRange;
  fidelityFirstRun?: boolean;
  allowEmpty?: boolean;
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const sizeClass = useSizeClass();
  const useFidelityFirstRun = fidelityFirstRun && isIOS() && sizeClass.width === "compact";

  if (!hasData && !allowEmpty && !useFidelityFirstRun) {
    if (isMobile) return <EmptyState icon={BackpackIcon} title={t("overview.emptyTitle")}
      hint={t("overview.emptyDescription")}
      action={<Button onClick={() => navigate("/settings/configuration")}>{t("overview.addFirstSource")}</Button>} />;
    return (
      <div className="flex items-center justify-center h-[400px]">
        <EmptyState icon={BackpackIcon} className="max-w-md w-full"
          title={t("pageWrapper.noData")} hint={t("pageWrapper.noDataHint")}
          action={<Button variant="outline" onClick={() => navigate("/settings")}>
              <OpenInNewWindowIcon className="mr-2 h-4 w-4" />
              {t("pageWrapper.goToSettings")}
            </Button>} />
      </div>
    );
  }

  if (!allowEmpty && !useFidelityFirstRun && (dateRange.start.getTime() === emptyDate.getTime() || dateRange.end.getTime() === emptyDate.getTime())) {
    return <div className="min-h-[400px]" />;
  }

  return <>{children}</>;
};

export default App;
