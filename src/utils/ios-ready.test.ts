import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), ios: true }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@/utils/platform", () => ({ isIOS: () => mocks.ios }));

import { isAppContentRendered, markIOSReady, reportIOSFrontendError } from "./ios-ready";

beforeEach(() => {
  document.body.innerHTML = "";
  mocks.ios = true;
  mocks.invoke.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("accepts the overview heading while its data is still loading", () => {
  document.body.innerHTML = '<main id="app-main-content"><div aria-busy="true"><h1>Overview</h1></div></main>';
  expect(isAppContentRendered()).toBe(true);
});

it("accepts the rendered empty portfolio on a fresh install", () => {
  document.body.innerHTML = '<main id="app-main-content"><div aria-busy="false"><div><p>No Data</p><button>Go to Settings</button></div></div></main>';
  expect(isAppContentRendered()).toBe(true);
});

it("does not accept a cleared loading container", () => {
  document.body.innerHTML = '<main id="app-main-content"><div aria-busy="false"></div></main>';
  expect(isAppContentRendered()).toBe(false);
});

it("marks iOS ready after the rendered app opens its bridge", async () => {
  document.body.innerHTML = '<main id="app-main-content"><div aria-busy="false"><h1>Overview</h1></div></main>';
  vi.stubEnv("VITE_TRACK3_IOS_READY_PROBE", "1");
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => callback(0));
  await markIOSReady();
  expect(mocks.invoke).toHaveBeenCalledWith("mark_frontend_ready");
});

it("does not invoke the CI probe in ordinary builds", async () => {
  document.body.innerHTML = '<main id="app-main-content"><h1>Overview</h1></main>';
  vi.stubEnv("VITE_TRACK3_IOS_READY_PROBE", "");
  await markIOSReady();
  expect(mocks.invoke).not.toHaveBeenCalled();
});

it("records a startup error in the simulator probe build", async () => {
  vi.stubEnv("VITE_TRACK3_IOS_READY_PROBE", "1");
  await reportIOSFrontendError("render failed");
  expect(mocks.invoke).toHaveBeenCalledWith("record_frontend_error", { message: "render failed" });
});
