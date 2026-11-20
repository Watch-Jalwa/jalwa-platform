import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 };

/** Better Auth compatible password hash: `saltHex:keyHex` via scrypt. */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(String(password).normalize("NFKC"), salt, 64, SCRYPT);
  return `${salt}:${Buffer.from(key).toString("hex")}`;
}

export async function verifyPassword({ hash, password }) {
  const [salt, key] = String(hash ?? "").split(":");
  if (!salt || !key) return false;
  const target = await scryptAsync(String(password).normalize("NFKC"), salt, 64, SCRYPT);
  const expected = Buffer.from(key, "hex");
  const actual = Buffer.from(target);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function validateLearnerPassword(password) {
  const value = String(password ?? "");
  if (value.length < 7 || value.length > 128) return false;
  return /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
}
