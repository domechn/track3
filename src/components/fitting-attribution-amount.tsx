import { useLayoutEffect, useRef, useState } from "react";

export function FittingAttributionAmount({ full, compact, minBarWidth }: {
  full: string; compact: string; minBarWidth?: number;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const element = root.current;
    const measure = probe.current;
    if (!element || !measure) return;
    const update = () => {
      measure.textContent = full;
      const bar = minBarWidth === undefined ? null : element.parentElement?.previousElementSibling;
      const spare = bar && minBarWidth !== undefined ? Math.max(0, bar.getBoundingClientRect().width - minBarWidth) : 0;
      setFits(measure.getBoundingClientRect().width <= element.getBoundingClientRect().width + spare + 0.5);
      measure.textContent = "";
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (minBarWidth !== undefined && element.parentElement?.parentElement)
      observer.observe(element.parentElement.parentElement);
    return () => observer.disconnect();
  }, [full, minBarWidth]);

  return <span ref={root} className="t3-signed-unit relative block min-w-0 w-full overflow-hidden whitespace-nowrap">
    <span ref={probe} className="absolute invisible whitespace-nowrap" aria-hidden="true" />
    {fits ? full : compact}
  </span>;
}
