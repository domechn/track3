export const refreshProgressEvent = "fidelity:mobile-refresh-progress";

export type RefreshProgressDetail = {
  active: boolean;
  total: number;
  completed: string[];
};

export function publishRefreshProgress(detail: RefreshProgressDetail) {
  window.dispatchEvent(new CustomEvent(refreshProgressEvent, { detail }));
}

export const refreshSourceEvent = "fidelity:mobile-refresh-source";

export function requestRefreshSource(sourceId: string) {
  window.dispatchEvent(new CustomEvent(refreshSourceEvent, { detail: sourceId }));
}

