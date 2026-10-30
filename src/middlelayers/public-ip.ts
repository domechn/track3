import { sendHttpRequest, sendHttpTextRequest } from "./datafetch/utils/http";

export type PublicIp = { address: string; version: 4 | 6 };

const PRIMARY = "https://api.ipify.org?format=json";
const FALLBACK = "https://1.1.1.1/cdn-cgi/trace";

function parsePublicIp(value: unknown): PublicIp {
  if (typeof value !== "string" || value.length > 45) throw new Error("Invalid public IP");
  const octets = value.split(".");
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) && octets.every((part) =>
    Number(part) <= 255 && (part === "0" || !part.startsWith("0")))) {
    const [a, b, c] = octets.map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)) throw new Error("Invalid public IP");
    return { address: value, version: 4 };
  }
  if (/^[0-9a-fA-F:]+$/.test(value) && value.includes(":")) {
    try {
      const hostname = new URL(`http://[${value}]/`).hostname;
      const first = Number.parseInt(hostname.slice(1).split(":")[0], 16);
      if (first >= 0x2000 && first <= 0x3fff && !hostname.startsWith("[2001:db8:")) {
        return { address: value, version: 6 };
      }
    } catch {
      // Invalid IPv6 syntax.
    }
  }
  throw new Error("Invalid public IP");
}

async function defaultRequest(url: string, timeout: number): Promise<unknown> {
  return url === PRIMARY
    ? sendHttpRequest<unknown>("GET", url, timeout)
    : sendHttpTextRequest("GET", url, timeout);
}

export async function detectPublicIp(
  request: (url: string, timeout: number) => Promise<unknown> = defaultRequest,
): Promise<PublicIp> {
  const deadline = Date.now() + 5000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Public IP lookup timed out")), 5000);
  });
  const lookup = async () => {
    try {
      const payload = await request(PRIMARY, Math.max(1, deadline - Date.now()));
      return parsePublicIp(payload && typeof payload === "object" && "ip" in payload ? payload.ip : undefined);
    } catch {
      if (Date.now() >= deadline) throw new Error("Public IP lookup timed out");
      const trace = await request(FALLBACK, Math.max(1, deadline - Date.now()));
      if (typeof trace !== "string" || trace.length > 4096) throw new Error("Invalid public IP");
      const line = trace.split(/\r?\n/).find((part) => part.startsWith("ip="));
      return parsePublicIp(line?.slice(3));
    }
  };
  try {
    return await Promise.race([lookup(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
