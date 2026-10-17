import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetch } from "@tauri-apps/plugin-http";
import { S3Client, parseListObjectsV2, signV4 } from "./s3-client";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));
const http = vi.mocked(fetch);
const config = {
  endpoint: "https://storage.example.test:9443/base",
  bucket: "private-bucket",
  region: "us-east-1",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret-value",
  sessionToken: "token-value",
};

beforeEach(() => http.mockReset());

describe("SigV4", () => {
  it("matches the AWS SigV4 get-vanilla published test vector", async () => {
    // https://github.com/aws/aws-sig-v4-test-suite/tree/master/get-vanilla
    const signed = await signV4({
      method: "GET",
      url: new URL("https://example.amazonaws.com/"),
      body: new Uint8Array(),
      region: "us-east-1",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      date: new Date("2015-08-30T12:36:00Z"),
      service: "service",
      signedPayloadHeader: false,
    });
    expect(signed.authorization).toContain("Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
  });

  it("matches the AWS get-vanilla-query-order-key published vector", async () => {
    // https://github.com/aws/aws-sig-v4-test-suite/tree/master/get-vanilla-query-order-key
    const signed = await signV4({
      method: "GET",
      url: new URL("https://example.amazonaws.com/?Param1=value2&Param1=Value1"),
      body: new Uint8Array(),
      region: "us-east-1",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      date: new Date("2015-08-30T12:36:00Z"),
      service: "service",
      signedPayloadHeader: false,
    });
    expect(signed.authorization).toContain("Signature=eedbc4e291e521cf13422ffca22be7d2eb8146eecf653089df300a15b2382bd1");
  });

  it("signs a canonical request with sorted query and temporary credentials", async () => {
    const signed = await signV4({
      method: "GET",
      url: new URL("https://example.amazonaws.com/bucket/a%20b?z=last&a=first"),
      body: new Uint8Array(),
      headers: { "x-amz-security-token": "token-value" },
      region: "us-east-1",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "secret-value",
      date: new Date("2015-08-30T12:36:00Z"),
    });
    expect(signed["x-amz-content-sha256"]).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(signed.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20150830\/us-east-1\/s3\/aws4_request,SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-security-token,Signature=[a-f0-9]{64}$/);
    expect(signed["x-amz-date"]).toBe("20150830T123600Z");
  });
});

describe("S3Client", () => {
  it("signs If-Match on manifest updates", async () => {
    http.mockResolvedValueOnce(new Response(null, { status: 200, headers: { ETag: '"next"' } }));
    await new S3Client(config).putObject("manifest", new Uint8Array([1]), { ifMatch: '"prior"' });
    const headers = http.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["if-match"]).toBe('"prior"');
    expect(headers.authorization).toContain("SignedHeaders=host;if-match;");
  });

  it("signs the virtual bucket host", async () => {
    const signed = await signV4({
      method: "GET", url: new URL("https://private-bucket.s3.example.test/snap/one"),
      body: new Uint8Array(), region: "us-east-1", accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "secret-value", date: new Date("2015-08-30T12:36:00Z"),
    });
    expect(signed.authorization).toContain("Signature=24717e30e66e58c0d5dd987c256096cb2abe2475ee0649a5322c24d8e86497e4");
  });

  it("does not retry a conditional PUT after a server failure", async () => {
    http.mockResolvedValueOnce(new Response("unknown outcome", { status: 503 }));
    const client = new S3Client({ ...config, retryBaseMs: 1 });
    await expect(client.putObject("manifest", new Uint8Array([1]), { ifMatch: '"prior"' }))
      .rejects.toMatchObject({ status: 503 });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("retries a throttled conditional PUT", async () => {
    http.mockResolvedValueOnce(new Response("throttled", { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { ETag: '"next"' } }));
    const client = new S3Client({ ...config, retryBaseMs: 1 });
    await expect(client.putObject("manifest", new Uint8Array([1]), { ifMatch: '"prior"' }))
      .resolves.toEqual({ etag: '"next"' });
    expect(http).toHaveBeenCalledTimes(2);
  });

  it("cancels failed response bodies before retry or throw", async () => {
    const cancelled: string[] = [];
    const failure = (status: number, label: string) => {
      const response = new Response(new ReadableStream({
        cancel: () => { cancelled.push(label); },
      }), { status });
      return response;
    };
    http.mockResolvedValueOnce(failure(503, "retry"))
      .mockResolvedValueOnce(new Response("ok", { status: 200, headers: { ETag: '"good"' } }))
      .mockResolvedValueOnce(failure(403, "throw"));
    const client = new S3Client({ ...config, retryBaseMs: 1 });
    await client.getObject("a");
    await expect(client.getObject("b")).rejects.toMatchObject({ status: 403 });
    expect(cancelled).toEqual(["retry", "throw"]);
  });

  it("stops retrying after the fourth failed read", async () => {
    for (let index = 0; index < 4; index++) http.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(new S3Client({ ...config, retryBaseMs: 1 }).getObject("a")).rejects.toMatchObject({ status: 503 });
    expect(http).toHaveBeenCalledTimes(4);
  });

  it("rejects dot and encoded dot path segments", async () => {
    const client = new S3Client(config);
    for (const path of ["snap/./a", "snap/../a", "snap/%2e/a", "snap/%2E%2e/a"]) {
      await expect(client.getObject(path)).rejects.toThrow(/path/i);
    }
    expect(http).not.toHaveBeenCalled();
  });

  it("decodes plus as space in URL encoded list keys", () => {
    expect(parseListObjectsV2("<ListBucketResult><EncodingType>url</EncodingType><IsTruncated>false</IsTruncated><Contents><Key>snap/a+b</Key><Size>1</Size></Contents></ListBucketResult>").objects[0].key)
      .toBe("snap/a b");
  });

  it("reads device manifest modification time for the device list", () => {
    const page = parseListObjectsV2("<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>devices/a/manifest</Key><ETag>\"a\"</ETag><Size>1</Size><LastModified>2026-01-02T03:04:05.000Z</LastModified></Contents></ListBucketResult>");
    expect(page.objects[0].lastModified).toBe("2026-01-02T03:04:05.000Z");
  });

  it("keeps an optional remote prefix outside logical object keys", async () => {
    http.mockResolvedValueOnce(new Response(null, { status: 200, headers: { ETag: '"a"' } }))
      .mockResolvedValueOnce(new Response("<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>team/one/sync-header</Key><ETag>\"a\"</ETag><Size>2</Size></Contents></ListBucketResult>", { status: 200 }));
    const client = new S3Client({ ...config, prefix: "team/one" });
    await client.putObject("sync-header", new Uint8Array([1]));
    expect(http.mock.calls[0][0]).toBe("https://storage.example.test:9443/base/private-bucket/team/one/sync-header");
    expect((await client.listObjectsV2()).objects[0].key).toBe("sync-header");
    expect(http.mock.calls[1][0]).toContain("prefix=team%2Fone%2F");
  });
  it("sends path-style conditional writes and returns the ETag", async () => {
    http.mockResolvedValueOnce(new Response(null, { status: 200, headers: { ETag: '"rev-1"' } }));
    const client = new S3Client({ ...config, addressingStyle: "path" });
    expect(await client.putObject("snap/a b", new Uint8Array([1, 2]), { ifNoneMatch: "*" })).toEqual({ etag: '"rev-1"' });
    const [url, init] = http.mock.calls[0];
    expect(url).toBe("https://storage.example.test:9443/base/private-bucket/snap/a%20b");
    expect((init?.headers as Record<string, string>)["if-none-match"]).toBe("*");
    expect((init?.headers as Record<string, string>).authorization).toContain("SignedHeaders=host;if-none-match;x-amz-content-sha256;x-amz-date;x-amz-security-token");
  });

  it("uses a virtual bucket host when requested", async () => {
    http.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await new S3Client({ ...config, endpoint: "https://s3.example.test", addressingStyle: "virtual" }).deleteObject("snap/one");
    expect(http.mock.calls[0][0]).toBe("https://private-bucket.s3.example.test/snap/one");
  });

  it("parses namespaced XML list pages and URL encoded object keys", async () => {
    http.mockResolvedValueOnce(new Response(
      '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><EncodingType>url</EncodingType><IsTruncated>true</IsTruncated><Contents><Key>snap%2Fa%20b</Key><ETag>&quot;one&quot;</ETag><Size>7</Size></Contents><NextContinuationToken>next+token</NextContinuationToken></ListBucketResult>',
      { status: 200 },
    ));
    const page = await new S3Client(config).listObjectsV2({ prefix: "snap/", continuationToken: "old token" });
    expect(page).toEqual({ objects: [{ key: "snap/a b", etag: '"one"', size: 7 }], nextContinuationToken: "next+token" });
    expect(http.mock.calls[0][0]).toContain("continuation-token=old%20token");
  });

  it("retries a throttled request and sanitizes failed responses", async () => {
    http.mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200, headers: { ETag: '"good"' } }));
    const client = new S3Client({ ...config, retryBaseMs: 1 });
    expect(Array.from((await client.getObject("snap/a"))?.body ?? [])).toEqual([111, 107]);
    expect(http).toHaveBeenCalledTimes(2);
    http.mockReset();
    http.mockResolvedValueOnce(new Response("secret-value token-value Authorization=private", { status: 403 }));
    try {
      await client.getObject("snap/a");
      throw new Error("Expected S3 error");
    } catch (error) {
      expect(error).toMatchObject({ status: 403 });
      expect(String(error)).not.toMatch(/secret-value|token-value|Authorization=private|storage\.example/);
    }
  });

  it("aborts a timed out request and does not retry caller cancellation", async () => {
    let aborted = false;
    http.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("secret-value"));
      });
    }));
    const client = new S3Client({ ...config, timeoutMs: 10, retryBaseMs: 1 });
    await expect(client.headObject("snap/a")).rejects.toThrow(/timed out/i);
    expect(aborted).toBe(true);
    expect(http).toHaveBeenCalledTimes(1);
    const controller = new AbortController();
    controller.abort();
    await expect(client.headObject("snap/a", controller.signal)).rejects.toThrow(/abort/i);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("stops an in-flight request when its caller aborts", async () => {
    const controller = new AbortController();
    http.mockImplementationOnce(() => new Promise(() => {}));
    const request = new S3Client({ ...config, timeoutMs: 5000 }).getObject("snap/a", controller.signal);
    await vi.waitFor(() => expect(http).toHaveBeenCalledTimes(1));
    controller.abort();
    await expect(Promise.race([request, new Promise((_, reject) => setTimeout(() => reject(new Error("abort was ignored")), 30))]))
      .rejects.toThrow("S3 request aborted");
  });

  it("treats missing objects as absent and rejects malformed list XML", async () => {
    const client = new S3Client(config);
    http.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await client.headObject("snap/missing")).toBeNull();
    http.mockResolvedValueOnce(new Response("<Error>secret-value</Error>", { status: 200 }));
    await expect(client.listObjectsV2()).rejects.toThrow(/Invalid S3 list response/);
  });

  it("rejects remote plaintext HTTP endpoints", () => {
    expect(() => new S3Client({ ...config, endpoint: "http://remote.example.test" })).toThrow();
    expect(() => new S3Client({ ...config, endpoint: "http://localhost:9000" })).not.toThrow();
  });

  it("does not expose malformed endpoint text in error properties", () => {
    try {
      new S3Client({ ...config, endpoint: "secret-value" });
      throw new Error("Expected invalid endpoint");
    } catch (error) {
      expect(String(error) + JSON.stringify(error)).not.toContain("secret-value");
    }
  });

  it("does not expose errors from reading a response body", async () => {
    const response = new Response("irrelevant", { status: 200, headers: { ETag: '"one"' } });
    let cancelled = false;
    response.body!.cancel = async () => { cancelled = true; };
    response.arrayBuffer = async () => { throw new Error("secret-value token-value"); };
    http.mockResolvedValueOnce(response);
    try {
      await new S3Client(config).getObject("snap/a");
      throw new Error("Expected read error");
    } catch (error) {
      expect(String(error)).toContain("S3");
      expect(String(error)).not.toMatch(/secret-value|token-value/);
    }
    expect(cancelled).toBe(true);
  });

  it("rejects a successful write without an ETag needed for compare-and-swap", async () => {
    const response = new Response("unneeded", { status: 200 });
    let cancelled = false;
    response.body!.cancel = async () => { cancelled = true; };
    http.mockResolvedValueOnce(response);
    await expect(new S3Client(config).putObject("manifest", new Uint8Array([1])))
      .rejects.toThrow(/ETag/);
    expect(cancelled).toBe(true);
  });

  it("rejects a read without the ETag needed for compare-and-swap", async () => {
    http.mockResolvedValueOnce(new Response("data", { status: 200 }));
    await expect(new S3Client(config).getObject("manifest")).rejects.toThrow(/ETag/);
  });

  it("rejects a list response without truncation metadata", async () => {
    http.mockResolvedValueOnce(new Response("<ListBucketResult/>", { status: 200 }));
    await expect(new S3Client(config).listObjectsV2()).rejects.toThrow(/Invalid S3 list response/);
  });

  it("times out a stalled response body", async () => {
    const response = new Response("irrelevant", { status: 200, headers: { ETag: '"one"' } });
    response.arrayBuffer = () => new Promise(() => {});
    http.mockResolvedValueOnce(response);
    const request = new S3Client({ ...config, timeoutMs: 10 }).getObject("snap/a");
    await expect(Promise.race([request, new Promise((_, reject) => setTimeout(() => reject(new Error("read was ignored")), 40))]))
      .rejects.toThrow("S3 response timed out");
  });
});
