import { ArrowBottomRightIcon, ArrowTopRightIcon } from "@radix-ui/react-icons";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Separator } from "./ui/separator";
import { useEffect, useState } from "react";
import { getQuoteColor, saveQuoteColor } from "@/middlelayers/configuration";

const App = () => {
  const [quoteColor, setQuoteColor] = useState<
    "green-up-red-down" | "red-up-green-down"
  >("green-up-red-down");

  useEffect(() => {
    loadGeneralSettings();
  }, []);

  async function loadGeneralSettings() {
    const f = await getQuoteColor();
    setQuoteColor(f);
  }

  function QuoteColor() {
    function onQuoteColorValueChange(val: string) {
      saveQuoteColor(val as "green-up-red-down" | "red-up-green-down");
    }
    return (
      <RadioGroup
        defaultValue={quoteColor}
        onValueChange={onQuoteColorValueChange}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="green-up-red-down" id="green-up-red-down" />
          <Label htmlFor="green-up-red-down">
            <div className="flex space-x-2">
              <div>Green Up/Red Down</div>
              <ArrowTopRightIcon className="w-4 h-4 text-green-800" />
              <ArrowBottomRightIcon className="w-4 h-4 text-red-800" />
            </div>
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="red-up-green-down" id="red-up-green-down" />
          <Label htmlFor="red-up-green-down">
            <div className="flex space-x-2">
              <div>Red Up/Green Down</div>
              <ArrowTopRightIcon className="w-4 h-4 text-red-800" />
              <ArrowBottomRightIcon className="w-4 h-4 text-green-800" />
            </div>
          </Label>
        </div>
      </RadioGroup>
    );
  }
  return (
    <div>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">General Settings</h3>
          <p className="text-sm text-muted-foreground">
            View or modify the general settings of the app
          </p>
        </div>
        <Separator />

        <div className="space-y-3">
          <div className="text-l font-bold text-left">Appearance</div>
          <div className="text-sm text-left text-gray-400">todo</div>
        </div>

        <div className="space-y-3">
          <div className="text-l font-bold text-left">Quote Color</div>
          <div>
            <QuoteColor />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
