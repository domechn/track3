import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchMock,
  getClientIDConfigurationMock,
  getVersionMock,
  getTauriVersionMock,
} = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  getClientIDConfigurationMock: vi.fn(),
  getVersionMock: vi.fn(),
  getTauriVersionMock: vi.fn(),
}));

vi.mock("@/middlelayers/configuration", () => ({
  getClientIDConfiguration: getClientIDConfigurationMock,
}));

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: fetchMock,
}));

vi.mock("@tauri-apps/api", () => ({
  app: {
    getVersion: getVersionMock,
    getTauriVersion: getTauriVersionMock,
  },
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => path),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

import { trackEventWithClientID } from "@/utils/app";

describe("trackEventWithClientID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClientIDConfigurationMock.mockResolvedValue("client-123");
    getVersionMock.mockResolvedValue("0.6.1");
    getTauriVersionMock.mockResolvedValue("2.10.1");
    fetchMock.mockResolvedValue({
      status: 202,
      text: vi.fn().mockResolvedValue(""),
    });
  });

  it("sends Aptabase events with client metadata through the Tauri HTTP plugin", async () => {
    await trackEventWithClientID("app_started", {
      screen: "overview",
      count: 3,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://eu.aptabase.com/api/v0/events");
    expect(request).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "App-Key": "A-EU-6972874637",
        "Content-Type": "application/json",
      }),
    });

    const [event] = JSON.parse(request.body);
    expect(event).toMatchObject({
      eventName: "app_started",
      props: {
        clientID: "client-123",
        screen: "overview",
        count: 3,
      },
      systemProps: expect.objectContaining({
        appVersion: "0.6.1",
        engineName: "Tauri",
        engineVersion: "2.10.1",
      }),
    });
    expect(event.sessionId).toEqual(expect.any(String));
    expect(event.timestamp).toEqual(expect.any(String));
  });

  it("reports Aptabase transport failures instead of silently accepting them", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({
      status: 500,
      text: vi.fn().mockResolvedValue("server error"),
    });

    await trackEventWithClientID("app_started");

    expect(errorSpy).toHaveBeenCalledWith(
      "track event failed",
      expect.objectContaining({
        message: "Aptabase tracking failed with status 500: server error",
      }),
    );

    errorSpy.mockRestore();
  });
});
