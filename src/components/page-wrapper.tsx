import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowTopRightIcon, ReloadIcon } from "@radix-ui/react-icons";
import { TDateRange } from "@/middlelayers/types";

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
  if (dateRange.start.toISOString() === dateRange.end.toISOString()) {
    // do not allow query all size
    return (
      <div className="flex items-center justify-center h-[600px]">
        <ReloadIcon
          className={"mr-2 h-10 w-10 animate-spin text-gray-300"}
        />
      </div>
    );
  }
  const navigate = useNavigate();
  return (
    <>
      {hasData ? (
        children
      ) : (
        <div className="flex items-center justify-center h-[400px]">
          <div className="space-y-2">
            <div className="text-xl font-bold text-left">
              There is no enough data
            </div>
            <div className="text-l text-muted-foreground text-left">
              Please add configurations in "settings" and click "Refresh" Button
            </div>
            <Button
              onClick={() => navigate("/settings")}
              className="float-right"
            >
              <ArrowTopRightIcon className="mr-2 h-4 w-4" />
              Go to settings
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
