import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { BackpackIcon, OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { TDateRange } from "@/middlelayers/types";
import { parseISO } from "date-fns";
import { useTranslation } from "@/i18n";
import FirstRunOverview from "@/components/first-run-overview";
import EmptyState from "./empty-state";

const emptyDate = parseISO("1970-01-01");

const App = ({
  hasData,
  children,
  dateRange,
  firstRunOverview = false,
}: {
  hasData: boolean;
  children: React.ReactNode;
  dateRange: TDateRange;
  firstRunOverview?: boolean;
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!hasData) {
    return (
      <>
      {firstRunOverview && <div className="t3-first-run-desktop"><FirstRunOverview /></div>}
      <div className={firstRunOverview ? "t3-first-run-legacy" : ""}>
      <div className="page-wrapper-empty flex items-center justify-center h-[400px]">
        <EmptyState icon={BackpackIcon} className="max-w-md w-full"
          title={t("pageWrapper.noData")} hint={t("pageWrapper.noDataHint")}
          action={<Button variant="outline" onClick={() => navigate("/settings")}>
              <OpenInNewWindowIcon className="mr-2 h-4 w-4" />
              {t("pageWrapper.goToSettings")}
            </Button>} />
      </div>
      </div>
      </>
    );
  }

  if (dateRange.start.getTime() === emptyDate.getTime() || dateRange.end.getTime() === emptyDate.getTime()) {
    return <div className="min-h-[400px]" />;
  }

  return <>{children}</>;
};

export default App;
