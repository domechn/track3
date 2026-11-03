import { useSyncExternalStore } from "react";

const query = "(min-width: 1500px)";
const snapshot = () => typeof window !== "undefined" && typeof window.matchMedia === "function"
  && window.matchMedia(query).matches;
const subscribe = (notify: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(query);
  if (media.addEventListener) {
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }
  media.addListener(notify);
  return () => media.removeListener(notify);
};

export function useWideDesktop() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
