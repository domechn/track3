import type { OtherAttachment } from "@/middlelayers/datafetch/types";

/**
 * Mask a sensitive string, showing first 4 and last 4 characters.
 * Returns "-" for falsy values; returns unchanged for length <= 8.
 */
export function maskSensitive(val: string): string {
  if (!val) {
    return "-";
  }
  if (val.length <= 8) {
    return val;
  }
  return `${val.slice(0, 4)}...${val.slice(-4)}`;
}

/**
 * Truncate a long address, showing first 6 and last 4 characters.
 * Returns "-" for falsy values; returns unchanged for length <= 12.
 */
export function truncateAddress(val: string): string {
  if (!val) {
    return "-";
  }
  if (val.length <= 12) {
    return val;
  }
  return `${val.slice(0, 6)}...${val.slice(-4)}`;
}

/**
 * Encode an OtherAttachment into the wire format "<kind>:<type>:<identity>".
 */
export function encodedAttachTo(a: OtherAttachment): string {
  return `${a.kind}:${a.type}:${a.identity}`;
}

/**
 * Parse a wire-format string "<kind>:<type>:<identity>" into an OtherAttachment.
 * Returns undefined when the input is falsy, malformed, or has an unknown kind.
 */
export function parseAttachTo(raw: string): OtherAttachment | undefined {
  if (!raw) {
    return undefined;
  }
  const idx1 = raw.indexOf(":");
  if (idx1 < 0) {
    return undefined;
  }
  const idx2 = raw.indexOf(":", idx1 + 1);
  if (idx2 < 0) {
    return undefined;
  }
  const kind = raw.slice(0, idx1);
  const type = raw.slice(idx1 + 1, idx2);
  const identity = raw.slice(idx2 + 1);
  if (kind !== "cex" && kind !== "wallet") {
    return undefined;
  }
  if (!type || !identity) {
    return undefined;
  }
  return { kind, type, identity };
}
