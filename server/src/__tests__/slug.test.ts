import { describe, it, expect } from "vitest";
import { createSlug, createUniqueSlug } from "../lib/slug.js";

describe("createSlug", () => {
  it("should convert English text to lowercase slug", () => {
    expect(createSlug("Hello World")).toBe("hello-world");
  });

  it("should handle Korean text", () => {
    expect(createSlug("한글 테스트")).toBe("한글-테스트");
  });

  it("should strip special characters", () => {
    expect(createSlug("Hello! @World# $Test%")).toBe("hello-world-test");
  });

  it("should collapse multiple spaces and dashes", () => {
    expect(createSlug("hello   world---test")).toBe("hello-world-test");
  });

  it("should strip leading and trailing dashes", () => {
    expect(createSlug("--hello world--")).toBe("hello-world");
  });

  it("should handle mixed Korean and English", () => {
    expect(createSlug("My 블로그 Post")).toBe("my-블로그-post");
  });
});

describe("createUniqueSlug", () => {
  it("should return base slug when no collision", () => {
    expect(createUniqueSlug("Hello World", [])).toBe("hello-world");
  });

  it("should append -2 on first collision", () => {
    expect(createUniqueSlug("Hello World", ["hello-world"])).toBe("hello-world-2");
  });

  it("should increment counter on multiple collisions", () => {
    expect(createUniqueSlug("Hello World", ["hello-world", "hello-world-2", "hello-world-3"])).toBe(
      "hello-world-4",
    );
  });
});
