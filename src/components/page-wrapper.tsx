import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { TDateRange } from "@/middlelayers/types";
import { parseISO } from "date-fns";
import { Card, CardContent } from "./ui/card";

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
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-7 px-6 text-center space-y-4">
            <div className="text-lg text-muted-foreground">
              There is not enough data
            </div>
            <div className="text-xs text-muted-foreground">
              Please add configurations in settings and click Refresh.
            </div>
            <Button variant="outline" onClick={() => navigate("/settings")}>
              <OpenInNewWindowIcon className="mr-2 h-4 w-4" />
              Go to settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (dateRange.start.getTime() === emptyDate.getTime() || dateRange.end.getTime() === emptyDate.getTime()) {
    return <div className="min-h-[400px]" />;
  }

  return <>{children}</>;
};

export default App;
