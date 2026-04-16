import * as api from "@tauri-apps/api";
import { getClientIDConfiguration } from "../middlelayers/configuration";
import { exists } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { fetch } from "@tauri-apps/plugin-http";

const APTABASE_APP_KEY = "A-EU-6972874637";
const APTABASE_HOSTS = {
  DEV: "http://localhost:3000",
  EU: "https://eu.aptabase.com",
  US: "https://us.aptabase.com",
} as const;

type AptabaseProps = Record<string, string | number>;

let aptabaseSessionId: string | undefined;

export async function getVersion() {
  return api.app.getVersion();
}

export async function getClientID() {
  return getClientIDConfiguration();
}

export async function trackEventWithClientID(
  event: string,
  props?: AptabaseProps,
) {
  try {
    const [cid, appVersion, tauriVersion] = await Promise.all([
      getClientID(),
      getVersion(),
      api.app.getTauriVersion(),
    ]);

    const endpoint = getAptabaseEndpoint(APTABASE_APP_KEY);
    if (!endpoint) {
      throw new Error(`unsupported Aptabase app key: ${APTABASE_APP_KEY}`);
    }

    const payload = [
      {
        timestamp: new Date().toISOString(),
        sessionId: getAptabaseSessionId(),
        eventName: event,
        systemProps: {
          isDebug: import.meta.env.DEV,
          osName: window.navigator.platform || "unknown",
          osVersion: window.navigator.userAgent || "",
          locale: window.navigator.language || "",
          engineName: "Tauri",
          engineVersion: tauriVersion,
          appVersion,
          sdkVersion: `track3-web@${appVersion}`,
        },
        props: {
          clientID: cid || "unknown",
          ...(props ?? {}),
        },
      },
    ];

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "App-Key": APTABASE_APP_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      connectTimeout: 5000,
    } as RequestInit & { connectTimeout: number });

    if (response.status > 299) {
      throw new Error(
        `Aptabase tracking failed with status ${response.status}: ${await response.text()}`,
      );
    }
  } catch (e) {
    console.error("track event failed", e);
  }
}

export async function getImageApiPath(cacheDir: string, symbol: string) {
  const filePath = `${cacheDir}/assets/coins/${symbol.toLowerCase()}.png`;

  // check if file exists
  return exists(filePath).then((res) => {
    if (!res) {
      // return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${symbol.toLowerCase()}.png`
      return "";
    }
    return convertFileSrc(filePath);
  });
}

export function reloadApp() {
  return relaunch();
}

function getAptabaseEndpoint(appKey: string) {
  const [, region] = appKey.split("-");
  return region in APTABASE_HOSTS
    ? `${APTABASE_HOSTS[region as keyof typeof APTABASE_HOSTS]}/api/v0/events`
    : null;
}

function getAptabaseSessionId() {
  aptabaseSessionId ??=
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return aptabaseSessionId;
}
