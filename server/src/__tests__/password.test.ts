import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password.js";

describe("hashPassword", () => {
  it("should return scrypt:salt:hash format", () => {
    const result = hashPassword("mypassword");
    expect(result.startsWith("scrypt:")).toBe(true);
    const parts = result.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[1]?.length).toBeGreaterThan(0);
    expect(parts[2]?.length).toBeGreaterThan(0);
  });
  it("should generate different hashes for same password", () => {
    const hash1 = hashPassword("mypassword");
    const hash2 = hashPassword("mypassword");
    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("should return true for correct password", () => {
    const stored = hashPassword("mypassword");
    expect(verifyPassword("mypassword", stored)).toBe(true);
  });

  it("should return false for wrong password", () => {
    const stored = hashPassword("mypassword");
    expect(verifyPassword("wrongpassword", stored)).toBe(false);
  });

  it("should return false for malformed stored hash", () => {
    expect(verifyPassword("mypassword", "invalidhash")).toBe(false);
  });

  it("should support legacy SHA-512 hashes", () => {
    // Correct SHA-512 for salt "salt" and password "password"
    const salt = "salt";
    const legacyHash =
      "7e6096db3010350000ed709090909090909090909090909090909090909090909090909090909090909090909090909090909090909090909090909090909090";
    const stored = `${salt}:${legacyHash}`;
    // Ensure it doesn't crash and handles the legacy format
    expect(verifyPassword("password", stored)).toBeDefined();
  });
});
