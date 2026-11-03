import { useEffect, useState } from "react";

export type WidthClass = "compact" | "regular" | "wide";
export type HeightClass = "compact" | "regular";

function currentSize() {
  const width: WidthClass = window.innerWidth >= 1000 ? "wide"
    : window.innerWidth >= 700 ? "regular" : "compact";
  const height: HeightClass = window.innerHeight < 500 ? "compact" : "regular";
  return { width, height };
}

export function useSizeClass() {
  const [size, setSize] = useState(currentSize);
  useEffect(() => {
    const update = () => setSize((previous) => {
      const next = currentSize();
      return previous.width === next.width && previous.height === next.height ? previous : next;
    });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

export function usePhoneWidth() {
  const [phone, setPhone] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setPhone(query.matches);
    query.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      query.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return phone;
}
