import { fetch } from "@tauri-apps/plugin-http";
import { S3Error, type ListOptions, type ListPage, type S3Store, type WriteConditions } from "./object-store";

type S3Config = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;
  sessionToken?: string;
  addressingStyle?: "path" | "virtual";
  timeoutMs?: number;
  retryBaseMs?: number;
};

type SignInput = {
  method: string;
  url: URL;
  body: Uint8Array;
  headers?: Record<string, string>;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  date?: Date;
  service?: string;
  signedPayloadHeader?: boolean;
};

const encoder = new TextEncoder();

function validPath(path: string): boolean {
  return path.split("/").every((part) => part !== "" && !/^(?:\.|%2e){1,2}$/i.test(part));
}

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: Uint8Array, value: string): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, encoder.encode(value)));
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQuery(url: URL): string {
  return [...url.searchParams]
    .map(([key, value]) => [encode(key), encode(value)])
    .sort(([aKey, aValue], [bKey, bValue]) =>
      aKey < bKey ? -1 : aKey > bKey ? 1 : aValue < bValue ? -1 : aValue > bValue ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export async function signV4(input: SignInput): Promise<Record<string, string>> {
  const date = input.date ?? new Date();
  const timestamp = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = timestamp.slice(0, 8);
  const payloadHash = hex(await crypto.subtle.digest("SHA-256", input.body));
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(input.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, " ")])),
    host: input.url.host,
    "x-amz-date": timestamp,
  };
  if (input.signedPayloadHeader !== false) headers["x-amz-content-sha256"] = payloadHash;
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(";");
  const canonicalHeaders = names.map((name) => `${name}:${headers[name]}\n`).join("");
  const canonicalRequest = [
    input.method.toUpperCase(),
    input.url.pathname,
    canonicalQuery(input.url),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const requestHash = hex(await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest)));
  const service = input.service ?? "s3";
  const scope = `${day}/${input.region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${requestHash}`;
  const dateKey = await hmac(encoder.encode(`AWS4${input.secretAccessKey}`), day);
  const regionKey = await hmac(dateKey, input.region);
  const serviceKey = await hmac(regionKey, service);
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = hex(await hmac(signingKey, stringToSign));
  delete headers.host;
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`,
  };
}

function xmlChild(parent: Element, name: string): Element | undefined {
  return Array.from(parent.children).find((child) => child.localName === name);
}

function xmlText(parent: Element, name: string): string | undefined {
  return xmlChild(parent, name)?.textContent ?? undefined;
}

export function parseListObjectsV2(xml: string): ListPage {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const root = doc.documentElement;
  if (root.localName !== "ListBucketResult" || doc.getElementsByTagName("parsererror").length) {
    throw new Error("Invalid S3 list response");
  }
  const encoded = xmlText(root, "EncodingType") === "url";
  const objects = Array.from(root.children)
    .filter((child) => child.localName === "Contents")
    .map((item) => {
      const rawKey = xmlText(item, "Key");
      const size = Number(xmlText(item, "Size"));
      if (rawKey === undefined || !Number.isSafeInteger(size) || size < 0) throw new Error("Invalid S3 list response");
      return {
        key: encoded ? decodeURIComponent(rawKey.replace(/\+/g, " ")) : rawKey,
        etag: xmlText(item, "ETag") ?? "",
        size,
        ...(xmlText(item, "LastModified") ? { lastModified: xmlText(item, "LastModified") } : {}),
      };
    });
  const truncation = xmlText(root, "IsTruncated");
  if (truncation !== "true" && truncation !== "false") throw new Error("Invalid S3 list response");
  const truncated = truncation === "true";
  const nextContinuationToken = xmlText(root, "NextContinuationToken");
  if (truncated && !nextContinuationToken) throw new Error("Invalid S3 list response");
  return { objects, nextContinuationToken: truncated ? nextContinuationToken : undefined };
}

async function discardResponse(response: Response): Promise<void> {
  try { await response.body?.cancel(); } catch { /* The reader may already own the stream. */ }
}

async function readResponse<T>(response: Response, read: () => Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new Error("S3 request aborted");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error("S3 request aborted"));
    signal?.addEventListener("abort", onAbort, { once: true });
  });
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("S3 response timed out")), timeoutMs);
  });
  try {
    return await Promise.race([
      read().catch(() => { throw new Error("S3 response read failed"); }),
      cancelled,
      deadline,
    ]);
  } catch (error) {
    await discardResponse(response);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export class S3Client implements S3Store {
  private readonly endpoint: URL;
  private readonly config: S3Config;

  constructor(config: S3Config) {
    let endpoint: URL;
    try {
      endpoint = new URL(config.endpoint);
    } catch {
      throw new Error("Invalid S3 configuration");
    }
    if ((endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname))) ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(config.bucket) ||
      (config.prefix !== undefined && config.prefix !== "" && !validPath(config.prefix)) ||
      !config.region || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error("Invalid S3 configuration");
    }
    if (config.addressingStyle === "virtual" && (endpoint.pathname !== "/" || endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1")) {
      throw new Error("Invalid S3 virtual-host endpoint");
    }
    this.endpoint = endpoint;
    this.config = config;
  }

  private url(key?: string): URL {
    if (key !== undefined && !validPath(key)) {
      throw new Error("Invalid S3 object path");
    }
    const url = new URL(this.endpoint);
    if (this.config.addressingStyle === "virtual") url.hostname = `${this.config.bucket}.${url.hostname}`;
    const base = this.endpoint.pathname.replace(/\/$/, "");
    const bucket = this.config.addressingStyle === "virtual" ? "" : `/${encode(this.config.bucket)}`;
    const path = [this.config.prefix, key].filter(Boolean).join("/");
    const object = path ? `/${path.split("/").map(encode).join("/")}` : "";
    url.pathname = `${base}${bucket}${object}` || "/";
    return url;
  }

  private async request(method: string, url: URL, body = new Uint8Array(), conditions?: WriteConditions, signal?: AbortSignal): Promise<Response> {
    url.search = canonicalQuery(url);
    const headers: Record<string, string> = {};
    if (conditions?.ifMatch !== undefined) headers["if-match"] = conditions.ifMatch;
    if (conditions?.ifNoneMatch !== undefined) headers["if-none-match"] = conditions.ifNoneMatch;
    if (this.config.sessionToken) headers["x-amz-security-token"] = this.config.sessionToken;
    const timeoutMs = this.config.timeoutMs ?? 15000;
    const retryBaseMs = this.config.retryBaseMs ?? 250;
    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw new Error("S3 request aborted");
      const signed = await signV4({
        method, url, body, headers, region: this.config.region,
        accessKeyId: this.config.accessKeyId, secretAccessKey: this.config.secretAccessKey,
      });
      const controller = new AbortController();
      let onAbort: () => void = () => {};
      const cancelled = new Promise<never>((_, reject) => {
        onAbort = () => {
          controller.abort();
          reject(new Error("S3 request aborted"));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
      });
      if (signal?.aborted) onAbort();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(new Error("S3 request timed out"));
        }, timeoutMs);
      });
      let response: Response;
      try {
        response = await Promise.race([
          fetch(url.toString(), {
            method,
            headers: signed,
            body: method === "PUT" ? body : undefined,
            signal: controller.signal,
            connectTimeout: timeoutMs,
          }),
          deadline,
          cancelled,
        ]);
      } catch {
        if (signal?.aborted) throw new Error("S3 request aborted");
        if (timedOut) throw new Error("S3 request timed out");
        throw new Error("S3 network request failed");
      } finally {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 3 &&
          !(response.status >= 500 && method === "PUT" && conditions &&
            (conditions.ifMatch !== undefined || conditions.ifNoneMatch !== undefined))) {
        await discardResponse(response);
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 30000)
          : Math.min(retryBaseMs * 2 ** attempt, 30000);
        await new Promise<void>((resolve, reject) => {
          const wait = setTimeout(() => {
            signal?.removeEventListener("abort", cancel);
            resolve();
          }, waitMs);
          const cancel = () => {
            clearTimeout(wait);
            reject(new Error("S3 request aborted"));
          };
          signal?.addEventListener("abort", cancel, { once: true });
        });
        continue;
      }
      if (!response.ok) {
        await discardResponse(response);
        throw new S3Error(`S3 request failed (status ${response.status})`, response.status);
      }
      return response;
    }
  }

  async putObject(key: string, body: Uint8Array, conditions?: WriteConditions, signal?: AbortSignal): Promise<{ etag: string }> {
    const response = await this.request("PUT", this.url(key), body, conditions, signal);
    const etag = response.headers.get("etag");
    await discardResponse(response);
    if (!etag) throw new Error("S3 response missing ETag");
    return { etag };
  }

  async getObject(key: string, signal?: AbortSignal): Promise<{ body: Uint8Array; etag: string } | null> {
    try {
      const response = await this.request("GET", this.url(key), undefined, undefined, signal);
      const etag = response.headers.get("etag");
      if (!etag) {
        await discardResponse(response);
        throw new Error("S3 response missing ETag");
      }
      const body = new Uint8Array(await readResponse(response, () => response.arrayBuffer(), this.config.timeoutMs ?? 15000, signal));
      return { body, etag };
    } catch (error) {
      if (error instanceof S3Error && error.status === 404) return null;
      throw error;
    }
  }

  async headObject(key: string, signal?: AbortSignal): Promise<{ etag: string; size: number } | null> {
    try {
      const response = await this.request("HEAD", this.url(key), undefined, undefined, signal);
      const etag = response.headers.get("etag");
      await discardResponse(response);
      if (!etag) throw new Error("S3 response missing ETag");
      return { etag, size: Number(response.headers.get("content-length") ?? 0) };
    } catch (error) {
      if (error instanceof S3Error && error.status === 404) return null;
      throw error;
    }
  }

  async deleteObject(key: string, signal?: AbortSignal): Promise<void> {
    await discardResponse(await this.request("DELETE", this.url(key), undefined, undefined, signal));
  }

  async listObjectsV2(options: ListOptions = {}): Promise<ListPage> {
    const url = this.url();
    url.searchParams.set("list-type", "2");
    url.searchParams.set("encoding-type", "url");
    const prefix = this.config.prefix ? `${this.config.prefix}/${options.prefix ?? ""}` : options.prefix;
    if (prefix !== undefined) url.searchParams.set("prefix", prefix);
    if (options.continuationToken !== undefined) url.searchParams.set("continuation-token", options.continuationToken);
    const response = await this.request("GET", url, undefined, undefined, options.signal);
    const xml = await readResponse(response, () => response.text(), this.config.timeoutMs ?? 15000, options.signal);
    const page = parseListObjectsV2(xml);
    if (this.config.prefix) {
      const base = `${this.config.prefix}/`;
      page.objects = page.objects.filter((item) => item.key.startsWith(base))
        .map((item) => ({ ...item, key: item.key.slice(base.length) }));
    }
    return page;
  }
}
