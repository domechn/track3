export const FULL_REFRESH_REQUEST_EVENT = "track3:full-refresh-request";

export function requestFullRefresh() {
  window.dispatchEvent(new Event(FULL_REFRESH_REQUEST_EVENT));
}
