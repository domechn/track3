import { useLayoutEffect, useRef } from "react";

export function useFittingAttributionTicks() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const axis = ref.current;
    if (!axis) return;
    const ticks = [...axis.querySelectorAll<HTMLElement>("[data-axis-tick]")];
    const update = () => {
      const boxes = ticks.map((tick) => tick.getBoundingClientRect());
      let right = -Infinity;
      for (let index = 0; index < ticks.length; index++) {
        const box = boxes[index];
        const show = index === 0 || index === ticks.length - 1 ||
          box.left - right >= 8 && boxes.at(-1)!.left - box.right >= 8;
        ticks[index].style.visibility = show ? "visible" : "hidden";
        if (show) right = box.right;
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(axis);
    let active = true;
    void document.fonts?.ready.then(() => { if (active) update(); });
    return () => { active = false; observer.disconnect(); };
  });

  return ref;
}
