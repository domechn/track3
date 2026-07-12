import { fetch } from "@tauri-apps/plugin-http";

const ERROR_DETAIL_MAX_LENGTH = 200;

function getSafeEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}

function redactSensitiveText(text: string): string {
  return text
    .replace(
      /(api[-_]?key|secret|signature|passphrase|token|authorization|password)=([^\s&,;]+)/gi,
      "$1=<REDACTED>",
    )
    .replace(
      /(api[-_]?key|secret|signature|passphrase|token|authorization|password)\s*:\s*([^\s&,;]+)/gi,
      "$1: <REDACTED>",
    );
}

function truncateText(
  text: string,
  maxLength = ERROR_DETAIL_MAX_LENGTH,
): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function extractErrorDetail(rawText: string): string | undefined {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      const msg = ["message", "msg", "error", "detail", "retMsg"]
        .map((k) => parsed[k])
        .find((v): v is string => typeof v === "string" && v.trim().length > 0);
      const code = ["code", "errorCode", "retCode", "status"]
        .map((k) => parsed[k])
        .find(
          (v): v is string | number =>
            typeof v === "string" || typeof v === "number",
        );

      const details: string[] = [];
      if (msg) {
        details.push(redactSensitiveText(msg.trim()));
      }
      if (code !== undefined) {
        details.push(`code ${code}`);
      }

      if (details.length > 0) {
        return truncateText(details.join(", "));
      }
    }
  } catch {
    // keep fallback for plain text responses
  }

  return truncateText(redactSensitiveText(trimmed));
}

function createHttpErrorMessage(
  method: string,
  url: string,
  status: number,
  responseText: string,
): string {
  const requestMeta = `${method.toUpperCase()} ${getSafeEndpoint(url)}`;
  const detail = extractErrorDetail(responseText);
  if (!detail) {
    return `Request failed (${requestMeta}) with status ${status}`;
  }
  return `Request failed (${requestMeta}) with status ${status}, detail: ${detail}`;
}

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
    const responseText = await resp.text().catch(() => "");
    throw new Error(
      createHttpErrorMessage(method, url, resp.status, responseText),
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
