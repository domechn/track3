import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { previewSourceNames } from "./source-display-name";

export function CoinSourceSummary({ names, template, locale, moreLabel, allLabel, lastPrefix = "" }: {
  names: string[];
  template: string;
  locale: string;
  moreLabel: string;
  allLabel: string;
  lastPrefix?: string;
}) {
  const { visible, remaining } = previewSourceNames(names);
  const [before, after = ""] = template.split(/\{sources?\}/);
  const parts = new Intl.ListFormat(locale === "zh" ? "zh-CN" : "en", {
    style: "long", type: "conjunction",
  }).formatToParts(visible);
  let index = 0;
  return <p className="coin-source-summary">{before}<span className="coin-source-inline">{parts.map((part, partIndex) =>
    part.type === "element" ? <span className="coin-source-name" key={partIndex} title={names[index]}>{index === visible.length - 1 ? lastPrefix : ""}{visible[index++]}</span> : part.value
  )}</span>{remaining > 0 && <>{" · "}<Popover><PopoverTrigger asChild><button type="button" className="coin-source-more">{moreLabel.replace("{count}", String(remaining))}</button></PopoverTrigger>
    <PopoverContent align="start" className="coin-source-popover" aria-label={allLabel}><strong>{allLabel}</strong><ul>{names.map((name, nameIndex) => <li key={nameIndex} title={name}>{name}</li>)}</ul></PopoverContent>
  </Popover></>}{after}</p>;
}
