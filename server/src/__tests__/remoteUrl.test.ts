import { describe, it, expect } from "vitest";
import { validateRemoteUrl } from "../lib/remoteUrl.js";

describe("validateRemoteUrl", () => {
  it("should accept valid public URLs", () => {
    expect(() => {
      validateRemoteUrl("https://google.com");
    }).not.toThrow();
    expect(() => {
      validateRemoteUrl("http://example.com/feed");
    }).not.toThrow();
    expect(() => {
      validateRemoteUrl("https://my-blog.net:8080");
    }).not.toThrow();
  });

  it("should reject invalid URL formats", () => {
    expect(() => {
      validateRemoteUrl("not-a-url");
    }).toThrow("ERR_INVALID_URL_FORMAT");
    expect(() => {
      validateRemoteUrl("/relative/path");
    }).toThrow("ERR_INVALID_URL_FORMAT");
  });

  it("should reject non-HTTP/HTTPS protocols", () => {
    expect(() => {
      validateRemoteUrl("ftp://example.com");
    }).toThrow("ERR_INVALID_PROTOCOL");
    expect(() => {
      validateRemoteUrl("file:///etc/passwd");
    }).toThrow("ERR_INVALID_PROTOCOL");
    expect(() => {
      validateRemoteUrl("javascript:alert(1)");
    }).toThrow("ERR_INVALID_PROTOCOL");
  });

  it("should reject localhost and loopback addresses", () => {
    expect(() => {
      validateRemoteUrl("http://localhost");
    }).toThrow("ERR_LOCALHOST_FORBIDDEN");
    expect(() => {
      validateRemoteUrl("https://localhost:3000");
    }).toThrow("ERR_LOCALHOST_FORBIDDEN");
    expect(() => {
      validateRemoteUrl("http://127.0.0.1");
    }).toThrow("ERR_LOCALHOST_FORBIDDEN");
    expect(() => {
      validateRemoteUrl("http://[::1]");
    }).toThrow("ERR_LOCALHOST_FORBIDDEN");
  });

  it("should reject private IP ranges", () => {
    // 10.0.0.0/8
    expect(() => {
      validateRemoteUrl("http://10.0.0.1");
    }).toThrow("ERR_PRIVATE_IP_FORBIDDEN");
    expect(() => {
      validateRemoteUrl("http://10.255.255.255");
    }).toThrow("ERR_PRIVATE_IP_FORBIDDEN");

    // 192.168.0.0/16
    expect(() => {
      validateRemoteUrl("http://192.168.0.1");
    }).toThrow("ERR_PRIVATE_IP_FORBIDDEN");
    expect(() => {
      validateRemoteUrl("http://192.168.100.50");
    }).toThrow("ERR_PRIVATE_IP_FORBIDDEN");

    // 172.16.0.0/12 (172.16 - 172.31)
    expect(() => {
      validateRemoteUrl("http://172.16.0.1");
    }).toThrow("ERR_PRIVATE_IP_FORBIDDEN");
    expect(() => {
      validateRemoteUrl("http://172.31.255.255");
    }).toThrow("ERR_PRIVATE_IP_FORBIDDEN");

    // 169.254.0.0/16 (Link-local)
    expect(() => {
      validateRemoteUrl("http://169.254.1.1");
    }).toThrow("ERR_PRIVATE_IP_FORBIDDEN");
  });

  it("should accept public IPs outside private ranges", () => {
    expect(() => {
      validateRemoteUrl("http://8.8.8.8");
    }).not.toThrow();
    expect(() => {
      validateRemoteUrl("http://172.32.0.1");
    }).not.toThrow(); // Outside 172.16-31
    expect(() => {
      validateRemoteUrl("http://192.169.0.1");
    }).not.toThrow(); // Outside 192.168
  });

  it("should reject self-subscription if mySiteUrl matches", () => {
    const myUrl = "https://my-awesome-blog.com";

    // Exact match
    expect(() => {
      validateRemoteUrl("https://my-awesome-blog.com", myUrl);
    }).toThrow("ERR_SELF_SUBSCRIPTION_FORBIDDEN");
    // With path
    expect(() => {
      validateRemoteUrl("https://my-awesome-blog.com/feed", myUrl);
    }).toThrow("ERR_SELF_SUBSCRIPTION_FORBIDDEN");
    // Different protocol but same host (strict check usually relies on hostname)
    // Our implementation checks hostname and port.
    expect(() => {
      validateRemoteUrl("http://my-awesome-blog.com", myUrl);
    }).toThrow("ERR_SELF_SUBSCRIPTION_FORBIDDEN");
  });

  it("should allow other URLs when mySiteUrl is provided", () => {
    const myUrl = "https://my-awesome-blog.com";
    expect(() => {
      validateRemoteUrl("https://other-blog.com", myUrl);
    }).not.toThrow();
  });
});
