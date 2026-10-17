const REDACTED = "<REDACTED>";
const secretField = /^(?:api.?key|api.?secret|access.?key|client.?secret|private.?key|secret|signature|token|access.?token|refresh.?token|password|passphrase|authorization|license.?key|cloud.?sync.?key|credentials?)$/i;
const configuredSecretField = /api.?key|secret|token|password|passphrase|license|credential|private.?key|access.?key/i;
const publicIdentifierField = /^(?:wallet|address|uuid|assetID|transactionHash)$/i;

export function configuredSecretValues(value: unknown): string[] {
  const secrets: string[] = [];
  const visit = (item: unknown, key = "") => {
    if (typeof item === "string") {
      if (configuredSecretField.test(key) && item.length >= 4) secrets.push(item);
    } else if (Array.isArray(item)) {
      item.forEach((entry) => visit(entry));
    } else if (item && typeof item === "object") {
      if (key === "headers") {
        Object.values(item).forEach((entry) => {
          if (typeof entry === "string" && entry.length >= 4) secrets.push(entry);
        });
        return;
      }
      Object.entries(item).forEach(([name, entry]) => visit(entry, name));
    }
  };
  visit(value);
  return secrets;
}

export function redactSecrets(text: string, configured: readonly string[] = [], preserveIdentifier = false): string {
  let clean = text;
  for (const value of configured.filter((item) => item.length >= 4).sort((a, b) => b.length - a.length)) {
    clean = clean.split(value).join(REDACTED);
  }
  return clean
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/gi, REDACTED)
    .replace(/([?&](?:api_?key|apikey|signature|secret|token|access_token|license_key)=)[^&#\s]+/gi, `$1${REDACTED}`)
    .replace(/(\b(?:api[-_]?key|api[-_]?secret|access[-_]?key|client[-_]?secret|private[-_]?key|secret|signature|token|password|passphrase|authorization|license[-_]?key)["']?\s*[:=]\s*["']?)([^\s&,;}"']+)/gi,
      (match, prefix: string, value: string) => {
        const tokenShaped = (value.length >= 6 && /[a-z]/i.test(value) && /\d/.test(value)) ||
          (value.length >= 8 && ((/[a-z]/.test(value) && /[A-Z]/.test(value)) || /[-_+/=]/.test(value)));
        return tokenShaped ? `${prefix}${REDACTED}` : match;
      })
    .replace(/(?<![A-Za-z0-9+/])(?:[a-fA-F0-9]{32,}|[A-Za-z0-9+]{30,}={1,2})(?![A-Za-z0-9+/=])/g, (candidate, offset: number, source: string) => {
      if (preserveIdentifier ||
          /^0x[a-fA-F0-9]{40}$|^0x[a-fA-F0-9]{64}$/.test(candidate) ||
          /^bc1[ac-hj-np-z02-9]{11,87}$/i.test(candidate) ||
          /\/(?:tx|address|account)\/$/i.test(source.slice(Math.max(0, offset - 12), offset)) ||
          (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(candidate) &&
            /(?:wallet|address|account)[:/\s]*$/i.test(source.slice(Math.max(0, offset - 24), offset)))) return candidate;
      return new Set(candidate.toLowerCase()).size >= 10 ? REDACTED : candidate;
    });
}

export function sanitizeUntrustedText(value: string, configured: readonly string[] = [], preserveIdentifier = false): string {
  return redactSecrets(value.replace(/[\u00ad\u180e\u200b-\u200d\u2060-\u2064\ufeff]/g, ""), configured, preserveIdentifier)
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/<\/?tool_result[^>]*>|<\/?think\b[^>]*>|<\|(?:im_start|im_end|system|assistant|user|developer|tool|eot_id|eom_id|start_header_id|end_header_id|begin_of_text|end_of_text)\|>|\[(?:\/?INST|im_start|im_end)\]|<\/?(?:start_of_turn|end_of_turn)>|<<\/?SYS>>/gi, "[untrusted text]");
}

export function sanitizeUntrustedData(value: unknown, configured: readonly string[] = [], depth = 0, preserveIdentifier = false): unknown {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (typeof value === "string") {
    const clean = sanitizeUntrustedText(value, configured, preserveIdentifier);
    return clean.length > 500 ? `${clean.slice(0, 236)}[truncated: field]${clean.slice(-246)}` : clean;
  }
  if (depth >= 12) return "[nested data omitted]";
  if (Array.isArray(value)) return value.map((item) => sanitizeUntrustedData(item, configured, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      String(sanitizeUntrustedData(key, configured, depth + 1, true)),
      secretField.test(key) ? REDACTED : sanitizeUntrustedData(item, configured, depth + 1, publicIdentifierField.test(key)),
    ]));
  }
  return value;
}

export function redactForExport<T>(value: T, configured: readonly string[] = []): T {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (secretField.test(key)) return REDACTED;
    if (typeof item !== "string") return item;
    return redactSecrets(item, configured, /^(?:wallet|address|uuid|assetID|transactionHash|eventId|lotId|symbol)$/i.test(key));
  })) as T;
}
