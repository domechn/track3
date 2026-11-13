import CryptoJS from "crypto-js";

const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function decodeBase58(address: string): number[] | undefined {
  if (!address || [...address].some((char) => !base58Alphabet.includes(char))) return;
  let value = 0n;
  for (const char of address) value = value * 58n + BigInt(base58Alphabet.indexOf(char));
  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 255n));
    value >>= 8n;
  }
  return [...Array(address.match(/^1*/)?.[0].length ?? 0).fill(0), ...bytes];
}

export function isSolanaAddress(address: string): boolean {
  if (address.length < 32 || address.length > 44) return false;
  return decodeBase58(address)?.length === 32;
}

function hex(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isBase58BitcoinAddress(address: string): boolean {
  const bytes = decodeBase58(address);
  if (bytes?.length !== 25 || (bytes[0] !== 0 && bytes[0] !== 5)) return false;
  const payload = CryptoJS.enc.Hex.parse(hex(bytes.slice(0, 21)));
  const checksum = CryptoJS.SHA256(CryptoJS.SHA256(payload)).toString(CryptoJS.enc.Hex).slice(0, 8);
  return checksum === hex(bytes.slice(21));
}

const bech32Alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values: number[]): number {
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (const [index, generator] of [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3].entries()) {
      if ((top >>> index) & 1) checksum ^= generator;
    }
  }
  return checksum;
}

function isSegwitBitcoinAddress(address: string): boolean {
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) return false;
  const normalized = address.toLowerCase();
  if (!normalized.startsWith("bc1") || normalized.length > 90) return false;
  const data = [...normalized.slice(3)].map((char) => bech32Alphabet.indexOf(char));
  if (data.length < 7 || data.some((value) => value < 0)) return false;
  const version = data[0];
  if (version > 16 || bech32Polymod([3, 3, 0, 2, 3, ...data]) !== (version === 0 ? 1 : 0x2bc830a3)) return false;
  const program: number[] = [];
  let accumulator = 0;
  let bits = 0;
  for (const value of data.slice(1, -6)) {
    accumulator = (accumulator << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      program.push((accumulator >>> bits) & 255);
    }
  }
  if (bits > 4 || ((accumulator << (8 - bits)) & 255) !== 0) return false;
  return program.length >= 2 && program.length <= 40 &&
    (version !== 0 || program.length === 20 || program.length === 32);
}

export function isBitcoinAddress(address: string): boolean {
  return isBase58BitcoinAddress(address) || isSegwitBitcoinAddress(address);
}

function tonCrc16(bytes: number[]): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

export function isTonAddress(address: string): boolean {
  if (/^(?:-1|0):[a-fA-F0-9]{64}$/.test(address)) return true;
  if (!/^[A-Za-z0-9_-]{48}$/.test(address)) return false;
  const bytes = [...atob(address.replace(/-/g, "+").replace(/_/g, "/"))].map((char) => char.charCodeAt(0));
  if (bytes.length !== 36 || ![0x11, 0x51, 0x91, 0xd1].includes(bytes[0])) return false;
  return tonCrc16(bytes.slice(0, 34)) === (bytes[34] << 8 | bytes[35]);
}
