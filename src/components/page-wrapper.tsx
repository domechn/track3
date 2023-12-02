import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import {
  ArrowTopRightIcon
} from "@radix-ui/react-icons";

// if there is no data, show a message and a button to go to settings page
const App = ({
  hasData,
  children,
}: {
  hasData: boolean;
  children: React.ReactNode;
}) => {
  const navigate = useNavigate();
  return (
    <>
      {hasData ? (
        children
      ) : (
        <div className="flex items-center justify-center h-[400px]">
          <div className="space-y-2">
            <div className="text-xl font-bold text-left">There is no enough data</div>
            <div className='text-l text-muted-foreground text-left'>
              Please add configurations in "settings" and click "Refresh" Button
            </div>
            <Button
              onClick={() => navigate("/settings")}
              className="float-right"
            >
              <ArrowTopRightIcon className="mr-2 h-4 w-4"/>
              Go to settings
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
