import { createHash, randomBytes, timingSafeEqual, scryptSync } from "crypto";

const SCRYPT_PREFIX = "scrypt:";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${SCRYPT_PREFIX}${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith(SCRYPT_PREFIX)) {
    const parts = stored.substring(SCRYPT_PREFIX.length).split(":");
    if (parts.length !== 2) return false;
    const [salt, storedHash] = parts as [string, string];
    const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    try {
      return timingSafeEqual(derivedKey, Buffer.from(storedHash, "hex"));
    } catch {
      return false;
    }
  }

  // Fallback for legacy SHA-512 hashes
  // Note: Insufficient computational effort for modern security, but kept for backward compatibility.
  // Successful legacy logins should trigger an automatic migration to scrypt in the auth service.
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, storedHash] = parts as [string, string];
  const hash = createHash("sha512")
    .update(salt + password)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}
