import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { OpenInNewWindowIcon, ReloadIcon } from "@radix-ui/react-icons";
import { TDateRange } from "@/middlelayers/types";
import { parseISO } from "date-fns";

const emptyDate = parseISO("1970-01-01");

// if there is no data, show a message and a button to go to settings page
const App = ({
  hasData,
  children,
  dateRange,
}: {
  hasData: boolean;
  children: React.ReactNode;
  dateRange: TDateRange;
}) => {
  function LoadingPage() {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <ReloadIcon className={"mr-2 h-10 w-10 animate-spin text-gray-300"} />
      </div>
    );
  }
  function NoDataPage() {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="space-y-2">
          <div className="text-xl font-bold text-left">
            There is no enough data
          </div>
          <div className="text-l text-muted-foreground text-left">
            Please add configurations in "settings" and click "Refresh" Button
          </div>
          <Button onClick={() => navigate("/settings")} className="float-right">
            <OpenInNewWindowIcon className="mr-2 h-4 w-4" />
            Go to settings
          </Button>
        </div>
      </div>
    );
  }

  function PageWrapper() {
    if (!hasData) {
      return <NoDataPage />;
    }

    // query range is not loaded yet
    if (dateRange.start.getTime() === emptyDate.getTime() || dateRange.end.getTime() === emptyDate.getTime()) {
      return <LoadingPage />;
    }

    return children;
  }

  const navigate = useNavigate();
  return <>{PageWrapper()}</>;
};

export default App;
