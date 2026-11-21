/**
 * Remote blog URL replacement helper
 *
 * Used on the receiving side: corrects image/resource URLs from remote blogs
 * that use relative paths or incorrect domains (e.g., localhost)
 * to the actual remote blog URL.
 */

import net from "node:net";
import { isPrivateOrReservedIp, safeFetch } from "@zebra/core/server";

/** Replace the domain of a single URL with the actual remote blog URL */
export function fixRemoteUrl(url: string | null, remoteSiteUrl: string): string | null {
  if (!url) return url;
  if (url.startsWith("/")) return remoteSiteUrl + url;
  return url.replace(/^https?:\/\/[^/]+(\/(uploads|img)\/)/, `${remoteSiteUrl}$1`);
}

/**
 * Replace image URL domains in content with the actual remote blog URL
 * - Relative paths: /uploads/... -> remoteSiteUrl/uploads/...
 * - Wrong domains: http://localhost/uploads/... -> remoteSiteUrl/uploads/...
 * - Handles both Markdown ![...](...) and HTML <img src="...">
 */
export function fixRemoteContentUrls(content: string, remoteSiteUrl: string): string {
  let fixed = content;
  // Fix single-slash relative markdown image URLs (previously had a typo matching //uploads)
  fixed = fixed.replace(/(!\[.*?\]\()(\/(uploads|img)\/[^)]+\))/g, `$1${remoteSiteUrl}$2`);
  fixed = fixed.replace(
    /(!\[.*?\]\()https?:\/\/[^/\s"')]+(\/(uploads|img)\/[^)]+\))/g,
    `$1${remoteSiteUrl}$2`,
  );
  fixed = fixed.replace(/(src=["'])(\/(uploads|img)\/)/g, `$1${remoteSiteUrl}$2`);
  fixed = fixed.replace(
    /(src=["'])https?:\/\/[^/\s"']+(\/(uploads|img)\/)/g,
    `$1${remoteSiteUrl}$2`,
  );
  return fixed;
}

/**
 * Validate a remote URL to prevent SSRF and self-referencing loops
 * @param url The URL to validate
 * @param mySiteUrl The URL of the current blog (to prevent self-subscription)
 * @throws Error if the URL is invalid or unsafe
 */
export function validateRemoteUrl(url: string, mySiteUrl?: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("ERR_INVALID_URL_FORMAT");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("ERR_INVALID_PROTOCOL");
  }

  const rawHost = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const hostname = rawHost.replace(/\.+$/, "");
  const allowLocal = process.env.ALLOW_LOCAL_FEDERATION === "true";

  if (!allowLocal) {
    // Block localhost, loopback (including 127.0.0.0/8, ::1, and trailing-dot localhost.)
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "::1" ||
      hostname === "0:0:0:0:0:0:0:1" ||
      hostname.startsWith("127.") ||
      hostname === "::ffff:127.0.0.1"
    ) {
      throw new Error("ERR_LOCALHOST_FORBIDDEN");
    }

    // Block all RFC1918, link-local, CGNAT, unspecified (0.0.0.0), and IPv6 private/reserved IP literals
    if (net.isIP(hostname) !== 0 && isPrivateOrReservedIp(hostname)) {
      throw new Error("ERR_PRIVATE_IP_FORBIDDEN");
    }
  }

  // Check against self (loop prevention)
  if (mySiteUrl) {
    let myParsed: URL | null = null;
    try {
      myParsed = new URL(mySiteUrl);
    } catch {
      // Ignore malformed mySiteUrl
    }

    if (myParsed) {
      if (parsed.hostname === myParsed.hostname && parsed.port === myParsed.port) {
        throw new Error("ERR_SELF_SUBSCRIPTION_FORBIDDEN");
      }
    }
  }
}

/**
 * Perform an outbound HTTP request with SSRF validation and DNS-rebinding protection.
 * Falls back to global fetch under NODE_ENV=test so unit tests stubbing fetch remain deterministic.
 */
export async function safeOutboundFetch(
  url: string,
  init: RequestInit = {},
  mySiteUrl?: string,
): Promise<Response> {
  validateRemoteUrl(url, mySiteUrl);
  if (process.env.NODE_ENV === "test") {
    return fetch(url, init);
  }
  return safeFetch(url, {
    ...init,
    allowLocal: process.env.ALLOW_LOCAL_FEDERATION === "true",
    timeoutMs: 10000,
  });
}
