import { describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSyncHeader, decryptObject, encryptObject, objectName } from "./crypto";
import { createRecoveryFile, openRecoveryFile } from "./recovery-file";

const syncPassphrase = "sync passphrase long enough";
const filePassphrase = "separate recovery passphrase";

describe("sync recovery file", () => {
  it("matches the reviewed v1 known-answer file", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T10:00:00.000Z"));
    const random = vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      if (array) new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0);
      return array;
    });
    try {
      const { header, key } = await createSyncHeader("vector passphrase");
      expect(Buffer.from(key).toString("hex")).toBe("de5261080b48ca42c2856255551481afb2d80cd268de353c7162ad33c3128ae3");
      const file = await createRecoveryFile(header, key, "vector passphrase", "independent file password");
      const path = resolve(process.cwd(), "tests/golden/t3key-v1.json");
      if (process.env.UPDATE_T3KEY_GOLDEN === "1") writeFileSync(path, `${JSON.stringify(JSON.parse(file), null, 2)}\n`);
      expect(JSON.parse(file)).toStrictEqual(JSON.parse(readFileSync(path, "utf8")));
      expect(await openRecoveryFile(file, "independent file password", header)).toEqual(key);
    } finally {
      random.mockRestore();
      vi.useRealTimers();
    }
  });
  it("encrypts only the root key and restores its object naming power", async () => {
    const { header, key } = await createSyncHeader(syncPassphrase);
    const file = await createRecoveryFile(header, key, syncPassphrase, filePassphrase);
    expect(file).not.toContain(Buffer.from(key).toString("base64"));
    expect(file).not.toContain(Buffer.from(key).toString("hex"));
    expect(Buffer.from(file).includes(Buffer.from(key))).toBe(false);
    expect(file).not.toContain(syncPassphrase);
    expect(file).not.toContain(filePassphrase);
    expect(Object.keys(JSON.parse(file))).toEqual(["format", "version", "createdAt", "header", "kdf", "cipher", "ciphertext"]);
    const recovered = await openRecoveryFile(file, filePassphrase, header);
    expect(recovered).toEqual(key);
    expect(await objectName(recovered, "snap/private")).toBe(await objectName(key, "snap/private"));
    const envelope = await encryptObject(key, "snap/private", new TextEncoder().encode("private data"));
    expect(new TextDecoder().decode(await decryptObject(recovered, "snap/private", envelope))).toBe("private data");
  });

  it("requires a distinct, strong file passphrase", async () => {
    const { header, key } = await createSyncHeader(syncPassphrase);
    await expect(createRecoveryFile(header, key, syncPassphrase, syncPassphrase)).rejects.toThrow(/passphrase/i);
    await expect(createRecoveryFile(header, key, syncPassphrase, "short")).rejects.toThrow(/passphrase/i);
  });

  it("rejects wrong passphrases, tampered fields, and truncated files without leaking secrets", async () => {
    const { header, key } = await createSyncHeader(syncPassphrase);
    const file = await createRecoveryFile(header, key, syncPassphrase, filePassphrase);
    const parsed = JSON.parse(file);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(openRecoveryFile(file, "wrong recovery passphrase", header)).rejects.toThrow();
      for (const changed of [
        { ...parsed, header: { salt: "AAAAAAAAAAAAAAAAAAAAAA==" } },
        { ...parsed, kdf: { ...parsed.kdf, iterations: 2 } },
        { ...parsed, cipher: { ...parsed.cipher, nonce: "AAAAAAAAAAAAAAAA" } },
        { ...parsed, ciphertext: parsed.ciphertext.slice(0, -4) + "AAAA" },
      ]) {
        await expect(openRecoveryFile(JSON.stringify(changed), filePassphrase, header)).rejects.toThrow();
      }
      await expect(openRecoveryFile(file.slice(0, -20), filePassphrase, header)).rejects.toThrow();
      const other = await createSyncHeader("other sync passphrase long enough");
      await expect(openRecoveryFile(file, filePassphrase, other.header)).rejects.toThrow();
      expect(JSON.stringify([...log.mock.calls, ...error.mock.calls])).not.toContain(Buffer.from(key).toString("hex"));
      expect(JSON.stringify([...log.mock.calls, ...error.mock.calls])).not.toContain(Buffer.from(key).toString("base64"));
      expect(JSON.stringify([...log.mock.calls, ...error.mock.calls])).not.toContain(syncPassphrase);
      expect(JSON.stringify([...log.mock.calls, ...error.mock.calls])).not.toContain(filePassphrase);
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });
});
