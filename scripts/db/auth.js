import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const SCRYPT_PREFIX = "scrypt";

export function hashPassword(password) {
  const raw = String(password || "").trim();
  if (!raw) {
    throw new Error("Senha inválida.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(raw, salt, 64).toString("hex");
  return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password, encodedHash) {
  if (!password || !encodedHash || typeof encodedHash !== "string") {
    return false;
  }

  const [prefix, salt, hash] = encodedHash.split("$");
  if (prefix !== SCRYPT_PREFIX || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const computed = crypto.scryptSync(String(password), salt, expected.length);

  if (computed.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(computed, expected);
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}
