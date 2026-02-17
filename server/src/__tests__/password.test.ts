import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password.js";

describe("hashPassword", () => {
  it("should return salt:hash format", () => {
    const result = hashPassword("mypassword");
    const parts = result.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0]?.length).toBeGreaterThan(0);
    expect(parts[1]?.length).toBeGreaterThan(0);
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
});
