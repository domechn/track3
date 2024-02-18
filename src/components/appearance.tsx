import { ArrowBottomRightIcon, ArrowTopRightIcon } from "@radix-ui/react-icons";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Separator } from "./ui/separator";
import { useEffect, useState } from "react";
import {
  getQuoteColor,
  saveQuoteColor,
  saveTheme,
} from "@/middlelayers/configuration";
import { QuoteColor } from "@/middlelayers/types";
import { Button } from "./ui/button";
import { reloadApp } from "@/utils/app";
import { useTheme, Theme } from "./common/theme";

const App = ({
  onQuoteColorChange,
}: {
  onQuoteColorChange?: (val: QuoteColor) => void;
}) => {
  const [quoteColor, setQuoteColor] = useState<QuoteColor>("green-up-red-down");
  const [theme, setTheme] = useState<Theme>("light");
  const t = useTheme();

  const borderColor = t.theme === "dark" ? "white" : "black";

  useEffect(() => {
    loadGeneralSettings();
  }, []);

  async function loadGeneralSettings() {
    const f = await getQuoteColor();
    setQuoteColor(f);

    setTheme(t.theme);
  }

  function Theme() {
    function onThemeValueChange(val: string) {
      const v = val as Theme;
      setTheme(v);
    }

    function onUpdatePreferencesButtonClick() {
      handleThemeValueChange(theme);
    }

    async function handleThemeValueChange(val: string) {
      const v = val as Theme;
      saveTheme(v);
      setTheme(v);

      reloadApp();
    }
    return (
      <div className="space-y-2">
        <RadioGroup
          onValueChange={onThemeValueChange}
          defaultValue={theme}
          className="grid max-w-md grid-cols-1 md:grid-cols-2 gap-8 pt-2"
        >
          <RadioGroupItem value="light" className="sr-only" id="light" />
          <Label htmlFor="light">
            <div
              className="items-center rounded-md border-2 border-muted p-1 hover:border-accent"
              style={{
                borderColor: theme === "light" ? borderColor : "",
              }}
            >
              <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
                <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                  <div className="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
                  <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                  <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                  <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                  <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                  <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                </div>
              </div>
            </div>
            <span className="block w-full p-2 text-center font-normal">
              Light
            </span>
          </Label>
          <RadioGroupItem value="dark" className="sr-only" id="dark" />
          <Label htmlFor="dark">
            <div
              className="items-center rounded-md border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground"
              style={{
                borderColor: theme === "dark" ? borderColor : "",
              }}
            >
              <div className="space-y-2 rounded-sm bg-slate-950 p-2">
                <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                  <div className="h-2 w-[80px] rounded-lg bg-slate-400" />
                  <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                  <div className="h-4 w-4 rounded-full bg-slate-400" />
                  <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                </div>
                <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                  <div className="h-4 w-4 rounded-full bg-slate-400" />
                  <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
                </div>
              </div>
            </div>
            <span className="block w-full p-2 text-center font-normal">
              Dark
            </span>
          </Label>
        </RadioGroup>
        <Button onClick={onUpdatePreferencesButtonClick}>
          Update Preferences
        </Button>
      </div>
    );
  }

  function QuoteColor() {
    function onQuoteColorValueChange(val: string) {
      handleQuoteColorValueChange(val);
    }

    async function handleQuoteColorValueChange(val: string) {
      const v = val as QuoteColor;
      await saveQuoteColor(v);
      setQuoteColor(v);
      if (onQuoteColorChange) {
        onQuoteColorChange(v);
      }
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
          <h3 className="text-lg font-medium">Appearance</h3>
          <p className="text-sm text-muted-foreground">
            Customize the appearance of the app. Automatically switch between
            day and night themes.
          </p>
        </div>
        <Separator />

        <div className="space-y-3">
          <div className="text-l font-bold text-left">Theme</div>
          <div className="text-sm text-left text-gray-400">
            <Theme />
          </div>
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
