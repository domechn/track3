import { fetch } from "@tauri-apps/plugin-http";

export function getCurrentUA() {
  const userAgent = window.navigator.userAgent;
  return userAgent;
}

export async function sendHttpRequest<T>(
  method: string,
  url: string,
  timeout = 5000,
  headers = {},
  json = {},
  formData = {},
): Promise<T> {
  const hs: { [k: string]: string } = {
    "user-agent": getCurrentUA(),
    ...headers,
  };
  if (Object.keys(json).length > 0) {
    hs["content-type"] = "application/json";
  }
  const payload: RequestInit = {
    method,
    headers: hs,
    connectTimeout: timeout,
  } as any;
  if (Object.keys(json).length > 0) {
    payload.body = JSON.stringify(json);
  }
  if (Object.keys(formData).length > 0) {
    const fd = new URLSearchParams();
    (Object.entries(formData) as [string, string][]).forEach(([k, v]) => {
      fd.append(k, v);
    });
    payload.body = fd;
  }

  const resp = await fetch(url, payload);
  if (resp.status > 299) {
    throw new Error(
      `Request failed with status ${resp.status}, message: ${await resp.text()}`,
    );
  }
  return resp.json();
}

export async function sendHttpTextRequest(
  method: string,
  url: string,
  timeout = 5000,
  headers = {},
  json = {},
  formData = {},
): Promise<string> {
  const hs: { [k: string]: string } = {
    "user-agent": getCurrentUA(),
    ...headers,
  };
  if (Object.keys(json).length > 0) {
    hs["content-type"] = "application/json";
  }
  const payload: RequestInit = {
    method,
    headers: hs,
    connectTimeout: timeout,
  } as any;
  if (Object.keys(json).length > 0) {
    payload.body = JSON.stringify(json);
  }
  if (Object.keys(formData).length > 0) {
    const fd = new URLSearchParams();
    (Object.entries(formData) as [string, string][]).forEach(([k, v]) => {
      fd.append(k, v);
    });
    payload.body = fd;
  }

  const resp = await fetch(url, payload);
  if (resp.status > 299) {
    throw new Error(
      `Request failed with status ${resp.status}, message: ${await resp.text()}`,
    );
  }
  return resp.text();
}
