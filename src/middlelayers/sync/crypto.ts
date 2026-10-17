import { argon2id } from "hash-wasm";

const VERSION = 1;
const MEMORY_KIB = 64 * 1024;
const ITERATIONS = 3;
const PARALLELISM = 1;
const encoder = new TextEncoder();
const derivedKeys = new WeakMap<Uint8Array, {
  hkdf: Promise<CryptoKey>;
  encryption?: Promise<CryptoKey>;
  naming?: Promise<CryptoKey>;
}>();

export type Envelope = {
  version: number;
  nonce: string;
  ciphertext: string;
};

export type SyncHeader = {
  version: number;
  kdf: {
    name: "argon2id";
    salt: string;
    memoryKiB: number;
    iterations: number;
    parallelism: number;
  };
  keyCheck: Envelope;
};

function encode64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode64(value: string): Uint8Array {
  if (typeof value !== "string" || value.length % 4 !== 0) {
    throw new Error("Invalid sync format");
  }
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const content = value.slice(0, value.length - padding);
  if (content.length % 4 !== (padding ? 4 - padding : 0) || /[^A-Za-z0-9+/]/.test(content)) {
    throw new Error("Invalid sync format");
  }
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new Error("Invalid sync format");
  }
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  if (!passphrase || salt.length !== 16) throw new Error("Invalid sync format");
  return argon2id({
    password: encoder.encode(passphrase),
    salt,
    memorySize: MEMORY_KIB,
    iterations: ITERATIONS,
    parallelism: PARALLELISM,
    hashLength: 32,
    outputType: "binary",
  });
}

function keysFor(root: Uint8Array) {
  let keys = derivedKeys.get(root);
  if (!keys) {
    keys = { hkdf: crypto.subtle.importKey("raw", root, "HKDF", false, ["deriveKey"]) };
    derivedKeys.set(root, keys);
  }
  return keys;
}

async function encryptionKey(root: Uint8Array): Promise<CryptoKey> {
  const keys = keysFor(root);
  return keys.encryption ??= crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode("track3-sync-v1"), info: encoder.encode("object-encryption") },
    await keys.hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function aad(path: string): Uint8Array {
  if (!path || path.startsWith("/") || path.includes("..")) throw new Error("Invalid sync path");
  return encoder.encode(`track3-sync-object-v${VERSION}:${path}`);
}

export async function encryptObject(key: Uint8Array, path: string, plaintext: Uint8Array): Promise<Envelope> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const aes = await encryptionKey(key);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: aad(path), tagLength: 128 },
    aes,
    plaintext,
  );
  return { version: VERSION, nonce: encode64(nonce), ciphertext: encode64(new Uint8Array(ciphertext)) };
}

export async function decryptObject(key: Uint8Array, path: string, envelope: Envelope): Promise<Uint8Array> {
  if (envelope.version !== VERSION) throw new Error("Unsupported sync format");
  const nonce = decode64(envelope.nonce);
  const ciphertext = decode64(envelope.ciphertext);
  if (nonce.length !== 12 || ciphertext.length < 16) throw new Error("Invalid sync format");
  const aes = await encryptionKey(key);
  return new Uint8Array(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce, additionalData: aad(path), tagLength: 128 },
    aes,
    ciphertext,
  ));
}

export async function createSyncHeader(passphrase: string): Promise<{ header: SyncHeader; key: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  return {
    header: {
      version: VERSION,
      kdf: { name: "argon2id", salt: encode64(salt), memoryKiB: MEMORY_KIB, iterations: ITERATIONS, parallelism: PARALLELISM },
      keyCheck: await encryptObject(key, "sync-header", encoder.encode("track3-sync-key-check-v1")),
    },
    key,
  };
}

export async function unlockSyncHeader(header: SyncHeader, passphrase: string): Promise<Uint8Array> {
  if (header.version !== VERSION || header.kdf?.name !== "argon2id" ||
    header.kdf.memoryKiB !== MEMORY_KIB || header.kdf.iterations !== ITERATIONS ||
    header.kdf.parallelism !== PARALLELISM) {
    throw new Error("Unsupported sync header");
  }
  const key = await deriveKey(passphrase, decode64(header.kdf.salt));
  try {
    const check = await decryptObject(key, "sync-header", header.keyCheck);
    if (new TextDecoder().decode(check) !== "track3-sync-key-check-v1") throw new Error();
  } catch {
    throw new Error("Incorrect sync passphrase or damaged header");
  }
  return key;
}

export async function objectName(key: Uint8Array, path: string): Promise<string> {
  aad(path);
  const slash = path.indexOf("/");
  const kind = slash < 0 ? path : path.slice(0, slash);
  if (!/^[a-z][a-z0-9-]*$/.test(kind)) throw new Error("Invalid sync path");
  const keys = keysFor(key);
  const hmac = await (keys.naming ??= crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode("track3-sync-v1"), info: encoder.encode("object-names") },
    await keys.hkdf,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"],
  ));
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", hmac, encoder.encode(path)));
  return `${kind}/${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
