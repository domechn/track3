import { fetch } from "@tauri-apps/plugin-http";
import { redactSecrets } from "../../security/redact";

const ERROR_DETAIL_MAX_LENGTH = 200;

export class HttpRequestError extends Error {
  status?: number;
  retryAfterMs?: number;

  constructor(message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = "HttpRequestError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function getSafeEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return redactSecrets(`${parsed.origin}${parsed.pathname}`);
  } catch {
    return redactSecrets(url.split("?")[0]);
  }
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
        details.push(redactSecrets(msg.trim()));
      }
      if (code !== undefined) {
        details.push(`code ${redactSecrets(String(code))}`);
      }

      if (details.length > 0) {
        return truncateText(details.join(", "));
      }
    }
  } catch {
    // keep fallback for plain text responses
  }

  return truncateText(redactSecrets(trimmed));
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

function parseRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) {
    return;
  }

  const numericSeconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(numericSeconds) && numericSeconds > 0) {
    return numericSeconds * 1000;
  }

  const retryAtMillis = Date.parse(retryAfter);
  if (Number.isNaN(retryAtMillis)) {
    return;
  }

  const diffMs = retryAtMillis - Date.now();
  if (diffMs <= 0) {
    return;
  }
  return diffMs;
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
      const retryAfterMs =
        response.status === 429 ? parseRetryAfterMs(response) : undefined;
      throw new HttpRequestError(
        createHttpErrorMessage(method, url, response.status, responseText),
        response.status,
        retryAfterMs,
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

export function isHttpStatusError(
  error: unknown,
  status: number,
): error is HttpRequestError | Error {
  if (error instanceof HttpRequestError) {
    return error.status === status;
  }
  if (error instanceof Error) {
    return new RegExp(`(?:^${status}(?:$|[\\s,:])|\\b(?:status|HTTP)\\s+${status}\\b)`, "i")
      .test(error.message);
  }
  return false;
}

type RetryOnHttpStatusOptions = {
  status: number;
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (error: Error, nextDelayMs: number, retriesLeft: number) => void;
};

export async function retryOnHttpStatus<T>(
  attempt: () => Promise<T>,
  options: RetryOnHttpStatusOptions,
): Promise<T> {
  const baseDelayMs = options.baseDelayMs ?? 3000;
  const maxDelayMs = options.maxDelayMs ?? 30000;

  let retriesLeft = options.maxRetries;
  while (true) {
    try {
      return await attempt();
    } catch (error) {
      if (!isHttpStatusError(error, options.status) || retriesLeft <= 0) {
        throw error;
      }
      const backoffFactor = 2 ** (options.maxRetries - retriesLeft);
      const fallbackDelay = Math.min(baseDelayMs * backoffFactor, maxDelayMs);
      const retryAfterMs =
        error instanceof HttpRequestError ? error.retryAfterMs : undefined;
      const waitMs =
        retryAfterMs !== undefined
          ? Math.min(retryAfterMs, maxDelayMs)
          : fallbackDelay;
      options.onRetry?.(error, waitMs, retriesLeft - 1);
      retriesLeft -= 1;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
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
