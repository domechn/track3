import { deriveKey, unlockSyncHeaderWithKey, validateSyncHeader, verifySyncHeaderKey, type SyncHeader } from "./crypto";

const encoder = new TextEncoder();
const format = "track3-sync-recovery";
const kdfContext = "track3-sync-recovery-v1";
const maxFileBytes = 4096;

type RecoveryFile = {
  format: string;
  version: number;
  createdAt: string;
  header: { salt: string };
  kdf: { name: string; salt: string; memoryKiB: number; iterations: number; parallelism: number };
  cipher: { name: string; nonce: string };
  ciphertext: string;
};

function encode64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode64(value: string, length: number): Uint8Array {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("Invalid recovery file");
  }
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  if (bytes.length !== length || encode64(bytes) !== value) throw new Error("Invalid recovery file");
  return bytes;
}

function canonical(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const fields = value as Record<string, unknown>;
    return `{${Object.keys(fields).sort().map((key) => `${JSON.stringify(key)}:${canonical(fields[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function aad(file: Omit<RecoveryFile, "ciphertext">): Uint8Array {
  return encoder.encode(canonical(file));
}

async function fileKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const root = await deriveKey(passphrase, salt);
  try {
    const input = await crypto.subtle.importKey("raw", root, "HKDF", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: encoder.encode(kdfContext), info: encoder.encode("file-key") },
      input, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
    );
  } finally {
    root.fill(0);
  }
}

export async function createRecoveryFile(
  header: SyncHeader,
  key: Uint8Array,
  syncPassphrase: string,
  filePassphrase: string,
): Promise<string> {
  if (filePassphrase.length < 16 || filePassphrase === syncPassphrase) {
    throw new Error("Use a separate recovery file passphrase of at least 16 characters");
  }
  if (key.length !== 32) throw new Error("Invalid sync key");
  validateSyncHeader(header);
  await verifySyncHeaderKey(header, key);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const fields = {
    format, version: 1, createdAt: new Date().toISOString(),
    header: { salt: header.kdf.salt },
    kdf: { name: "argon2id", salt: encode64(salt), memoryKiB: 65536, iterations: 3, parallelism: 1 },
    cipher: { name: "AES-256-GCM", nonce: encode64(nonce) },
  };
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: aad(fields), tagLength: 128 },
    await fileKey(filePassphrase, salt), key,
  ));
  return JSON.stringify({ ...fields, ciphertext: encode64(ciphertext) });
}

export async function openRecoveryFile(text: string, passphrase: string, header: SyncHeader): Promise<Uint8Array> {
  if (encoder.encode(text).length > maxFileBytes) throw new Error("Invalid recovery file");
  try {
    const file = JSON.parse(text) as RecoveryFile;
    if (!file || typeof file !== "object" || Array.isArray(file) ||
      Object.keys(file).sort().join() !== "cipher,ciphertext,createdAt,format,header,kdf,version" ||
      Object.keys(file.header ?? {}).sort().join() !== "salt" ||
      Object.keys(file.kdf ?? {}).sort().join() !== "iterations,memoryKiB,name,parallelism,salt" ||
      Object.keys(file.cipher ?? {}).sort().join() !== "name,nonce" ||
      file.format !== format || file.version !== 1 ||
      typeof file.createdAt !== "string" || !Number.isFinite(Date.parse(file.createdAt)) ||
      file.kdf.name !== "argon2id" || file.kdf.memoryKiB !== 65536 ||
      file.kdf.iterations !== 3 || file.kdf.parallelism !== 1 ||
      file.cipher.name !== "AES-256-GCM") throw new Error();
    decode64(file.header.salt, 16);
    const headerSalt = validateSyncHeader(header);
    if (file.header.salt !== encode64(headerSalt)) throw new Error();
    const salt = decode64(file.kdf.salt, 16);
    const nonce = decode64(file.cipher.nonce, 12);
    const ciphertext = decode64(file.ciphertext, 48);
    const { ciphertext: _ciphertext, ...fields } = file;
    const key = new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aad(fields), tagLength: 128 },
      await fileKey(passphrase, salt), ciphertext,
    ));
    try {
      return await unlockSyncHeaderWithKey(header, key);
    } finally {
      key.fill(0);
    }
  } catch {
    throw new Error("Recovery file is invalid, has the wrong passphrase, or belongs to another sync bucket");
  }
}
