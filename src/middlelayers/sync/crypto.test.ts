import { describe, expect, it, vi } from "vitest";
import {
  createSyncHeader,
  decryptObject,
  deriveKey,
  encryptObject,
  objectName,
  unlockSyncHeader,
} from "./crypto";

const text = new TextEncoder();

describe("sync crypto", () => {
  it("reuses derived encryption and naming keys for the same root key", async () => {
    const root = new Uint8Array(32);
    const derive = vi.spyOn(crypto.subtle, "deriveKey");
    try {
      await encryptObject(root, "snap/one", text.encode("one"));
      await encryptObject(root, "snap/two", text.encode("two"));
      await objectName(root, "snap/one");
      await objectName(root, "snap/two");
      expect(derive).toHaveBeenCalledTimes(2);
    } finally {
      derive.mockRestore();
    }
  });
  it("unlocks a header only with the original passphrase", async () => {
    const { header, key } = await createSyncHeader("correct horse battery staple");
    expect(header.kdf.name).toBe("argon2id");
    expect((await unlockSyncHeader(header, "correct horse battery staple"))).toEqual(key);
    await expect(unlockSyncHeader(header, "wrong passphrase")).rejects.toThrow();
  });

  it("uses a fresh nonce and detects ciphertext tampering", async () => {
    const { key } = await createSyncHeader("a long passphrase");
    const first = await encryptObject(key, "snap/private-id", text.encode('{"n":1}'));
    const second = await encryptObject(key, "snap/private-id", text.encode('{"n":1}'));
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    const tampered = { ...first, ciphertext: first.ciphertext.slice(0, -4) + "AAAA" };
    await expect(decryptObject(key, "snap/private-id", tampered)).rejects.toThrow();
  });

  it("binds the encrypted data to its path and format version", async () => {
    const { key } = await createSyncHeader("a long passphrase");
    const envelope = await encryptObject(key, "snap/one", text.encode("private"));
    await expect(decryptObject(key, "snap/two", envelope)).rejects.toThrow();
    await expect(decryptObject(key, "snap/one", { ...envelope, version: 2 })).rejects.toThrow();
  });

  it("decrypts a fixed AES-256-GCM vector with path AAD", async () => {
    // Independently generated with Node HKDF and crypto.createCipheriv, using a zero root key and nonce.
    const plaintext = await decryptObject(new Uint8Array(32), "snap/a", {
      version: 1,
      nonce: "AAAAAAAAAAAAAAAA",
      ciphertext: "Te7dIxkR9Ir9TM3x710bCf3Pei8p",
    });
    expect(new TextDecoder().decode(plaintext)).toBe("hello");
  });

  it("pins Argon2id derivation and the opaque object name", async () => {
    const key = await deriveKey("vector passphrase", new Uint8Array(16));
    expect(Buffer.from(key).toString("hex")).toBe("de5261080b48ca42c2856255551481afb2d80cd268de353c7162ad33c3128ae3");
    expect(await objectName(key, "snap/vector-id"))
      .toBe("snap/b60da97c23cfbb0eba4fbaf650419e5421735e92a3abaab982da399019f89fdc");
  });

  it("rejects modified KDF settings before deriving a key", async () => {
    const { header } = await createSyncHeader("a long passphrase");
    await expect(unlockSyncHeader({ ...header, kdf: { ...header.kdf, iterations: 1 } }, "a long passphrase"))
      .rejects.toThrow(/header/i);
  });

  it("derives stable opaque names separately for each logical path", async () => {
    const { key } = await createSyncHeader("a long passphrase");
    const one = await objectName(key, "snap/uuid-one");
    expect(one).toMatch(/^snap\/[0-9a-f]{64}$/);
    expect(one).toBe(await objectName(key, "snap/uuid-one"));
    expect(one).not.toBe(await objectName(key, "snap/uuid-two"));
    expect(one).not.toContain("uuid");
  });
});
