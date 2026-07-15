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

function createRequestErrorMessage(method: string, url: string): string {
  return `Request failed (${method.toUpperCase()} ${getSafeEndpoint(url)})`;
}

function createTimeoutErrorMessage(
  method: string,
  url: string,
  timeout: number,
): string {
  return `Request timed out (${method.toUpperCase()} ${getSafeEndpoint(url)}) after ${timeout}ms`;
}

export function getCurrentUA() {
  const userAgent = window.navigator.userAgent;
  return userAgent;
}

type RequestPayload = RequestInit & {
  connectTimeout: number;
};

type RequestHeaders = Record<string, string | undefined>;

function createRequestPayload(
  method: string,
  timeout: number,
  signal: AbortSignal,
  headers: RequestHeaders,
  json: object,
  formData: object,
): RequestPayload {
  const hs: { [k: string]: string } = {
    "user-agent": getCurrentUA(),
  };
  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined) {
      hs[key] = value;
    }
  });
  if (Object.keys(json).length > 0) {
    hs["content-type"] = "application/json";
  }
  const payload: RequestPayload = {
    method,
    headers: hs,
    connectTimeout: timeout,
    signal,
  };
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

  return payload;
}

async function withTotalTimeout<T>(
  method: string,
  url: string,
  timeout: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(createTimeoutErrorMessage(method, url, timeout)));
      controller.abort();
    }, timeout);
  });

  try {
    return await Promise.race([operation(controller.signal), timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function performHttpRequest<T>(
  method: string,
  url: string,
  timeout: number,
  headers: RequestHeaders,
  json: object,
  formData: object,
  readResponse: (response: Response) => Promise<T>,
  readFailure: string,
): Promise<T> {
  return withTotalTimeout(method, url, timeout, async (signal) => {
    let payload: RequestPayload;
    try {
      payload = createRequestPayload(
        method,
        timeout,
        signal,
        headers,
        json,
        formData,
      );
    } catch {
      throw new Error(createRequestErrorMessage(method, url));
    }

    let response: Response;
    try {
      response = await fetch(url, payload);
    } catch {
      throw new Error(createRequestErrorMessage(method, url));
    }

    if (response.status > 299) {
      const responseText = await response.text().catch(() => "");
      throw new Error(
        createHttpErrorMessage(method, url, response.status, responseText),
      );
    }

    try {
      return await readResponse(response);
    } catch {
      throw new Error(
        `${createRequestErrorMessage(method, url)} ${readFailure}`,
      );
    }
  });
}

export async function sendHttpRequest<T>(
  method: string,
  url: string,
  timeout = 5000,
  headers: RequestHeaders = {},
  json: object = {},
  formData: object = {},
): Promise<T> {
  return performHttpRequest(
    method,
    url,
    timeout,
    headers,
    json,
    formData,
    (response) => response.json() as Promise<T>,
    "while parsing JSON response",
  );
}

export async function sendHttpTextRequest(
  method: string,
  url: string,
  timeout = 5000,
  headers: RequestHeaders = {},
  json: object = {},
  formData: object = {},
): Promise<string> {
  return performHttpRequest(
    method,
    url,
    timeout,
    headers,
    json,
    formData,
    (response) => response.text(),
    "while reading text response",
  );
}
