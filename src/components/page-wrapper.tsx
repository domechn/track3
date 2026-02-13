import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { TDateRange } from "@/middlelayers/types";
import { parseISO } from "date-fns";

const emptyDate = parseISO("1970-01-01");

const App = ({
  hasData,
  children,
  dateRange,
}: {
  hasData: boolean;
  children: React.ReactNode;
  dateRange: TDateRange;
}) => {
  const navigate = useNavigate();

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="space-y-3 text-center">
          <div className="text-xl font-bold">
            There is no enough data
          </div>
          <div className="text-muted-foreground">
            Please add configurations in "settings" and click "Refresh" Button
          </div>
          <Button onClick={() => navigate("/settings")}>
            <OpenInNewWindowIcon className="mr-2 h-4 w-4" />
            Go to settings
          </Button>
        </div>
      </div>
    );
  }

  if (dateRange.start.getTime() === emptyDate.getTime() || dateRange.end.getTime() === emptyDate.getTime()) {
    return <div className="min-h-[400px]" />;
  }

  return <>{children}</>;
};

export default App;
