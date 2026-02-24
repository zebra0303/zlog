import { describe, it, expect } from "vitest";
import { parseUserAgent } from "../lib/userAgent.js";

describe("User Agent Parser", () => {
  it("should parse Windows Chrome correctly", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({ os: "Windows", browser: "Chrome" });
  });

  it("should parse macOS Safari correctly", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    expect(parseUserAgent(ua)).toEqual({ os: "macOS", browser: "Safari" });
  });

  it("should parse iPhone Safari correctly", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toEqual({ os: "iOS", browser: "Safari" });
  });

  it("should parse Android Chrome correctly", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({ os: "Android", browser: "Chrome" });
  });

  it("should parse Edge correctly", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(parseUserAgent(ua)).toEqual({ os: "Windows", browser: "Edge" });
  });

  it("should parse Firefox correctly", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0";
    expect(parseUserAgent(ua)).toEqual({ os: "Windows", browser: "Firefox" });
  });

  it("should handle unknown user agents", () => {
    expect(parseUserAgent("unknown")).toEqual({ os: "Unknown", browser: "Unknown" });
  });
});
