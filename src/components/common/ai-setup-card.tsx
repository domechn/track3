import { useEffect, useState } from "react";
import { MagicWandIcon, PaperPlaneIcon } from "@radix-ui/react-icons";
import { loadAIConfig } from "@/middlelayers/configuration";
import { storePendingAssistantQuestion, type SetupAssistantQuestion } from "@/middlelayers/ai/pending-question";
import { useTranslation } from "@/i18n";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";

export default function AISetupCard({
  page, summary, suggestions,
}: {
  page: SetupAssistantQuestion["page"];
  summary: string;
  suggestions: string[];
}) {
  const { t } = useTranslation();
  const [availability, setAvailability] = useState<"ready" | "missing" | "actions-disabled" | null>(null);
  const configured = availability === "ready";
  const [question, setQuestion] = useState("");
  useEffect(() => {
    let active = true;
    void loadAIConfig().then(
      (config) => { if (active) setAvailability(config.allowActions === false ? "actions-disabled" : "ready"); },
      () => { if (active) setAvailability("missing"); },
    );
    return () => { active = false; };
  }, []);
  function send(text: string) {
    if (!configured || !text.trim()) return;
    try {
      storePendingAssistantQuestion({ question: text.trim(), page, summary });
      window.location.hash = "#/assistant";
    } catch {
      setAvailability("missing");
    }
  }
  return <Card className="border-primary/25 bg-primary/[0.035]">
    <CardContent className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <MagicWandIcon aria-hidden className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{t("aiSetup.title")}</h2>
      </div>
      {availability === "missing" || availability === "actions-disabled" ? <p className="text-sm text-muted-foreground">
        {t(availability === "actions-disabled" ? "aiSetup.actionsDisabled" : "aiSetup.configureNotice")}{" "}
        <a className="font-medium text-primary underline underline-offset-2" href="#/settings/assistant">{t("aiSetup.configureLink")}</a>
      </p> : <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); send(question); }}>
        <Input aria-label={t("aiSetup.question")} className="h-8 min-w-0 text-sm" placeholder={t("aiSetup.placeholder")}
          value={question} onChange={(event) => setQuestion(event.target.value)} disabled={!configured} />
        <Button type="submit" size="sm" className="h-8 shrink-0 gap-1.5" disabled={!configured || !question.trim()}>
          <PaperPlaneIcon aria-hidden className="h-3.5 w-3.5" />{t("aiSetup.send")}
        </Button>
      </form>}
      {configured && <div className="flex flex-wrap gap-1.5" aria-label={t("aiSetup.suggestions")}>
        {suggestions.map((suggestion) => <button key={suggestion} type="button" data-ai-setup-suggestion
          className="touch:min-h-11 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => send(suggestion)}>{suggestion}</button>)}
      </div>}
    </CardContent>
  </Card>;
}
