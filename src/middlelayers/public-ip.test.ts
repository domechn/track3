import { afterEach, describe, expect, it, vi } from "vitest";
import { detectPublicIp } from "./public-ip";

afterEach(() => vi.useRealTimers());

describe("detectPublicIp", () => {
  it("uses the IPv4 JSON result from the primary host", async () => {
    const request = vi.fn(async (_url: string, _timeout: number) => ({ ip: "8.8.8.8" }));
    await expect(detectPublicIp(request)).resolves.toEqual({ address: "8.8.8.8", version: 4 });
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]).toBe("https://api.ipify.org?format=json");
  });

  it("falls back to the trace IP when the primary request fails", async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("fl=123\nip=1.1.1.1\nts=123\n");
    await expect(detectPublicIp(request)).resolves.toEqual({ address: "1.1.1.1", version: 4 });
    expect(request.mock.calls[1][0]).toBe("https://1.1.1.1/cdn-cgi/trace");
  });

  it.each([
    ["<html>8.8.8.8</html>", "ip=hello"],
    [{ ip: "10.0.0.1" }, "ip=127.0.0.1"],
    [{ ip: "192.168.0.1" }, "ip=172.16.0.1"],
    [{ ip: "8.8.8.8" + "x".repeat(1000) }, "ip=169.254.1.1"],
  ])("rejects invalid or private addresses from both hosts", async (primary, trace) => {
    const request = vi.fn().mockResolvedValueOnce(primary).mockResolvedValueOnce(trace);
    await expect(detectPublicIp(request)).rejects.toThrow();
  });

  it("accepts a public IPv6 fallback and rejects local IPv6", async () => {
    await expect(detectPublicIp(vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("ip=2606:4700::1111\n")))
      .resolves.toEqual({ address: "2606:4700::1111", version: 6 });
    await expect(detectPublicIp(vi.fn()
      .mockResolvedValueOnce({ ip: "::1" })
      .mockResolvedValueOnce("ip=fc00::1\n"))).rejects.toThrow();
  });

  it("ends a stalled lookup after five seconds", async () => {
    vi.useFakeTimers();
    const request = vi.fn(() => new Promise<never>(() => {}));
    const result = detectPublicIp(request);
    const rejected = expect(result).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(5000);
    await rejected;
    expect(request).toHaveBeenCalledTimes(1);
  });
});
