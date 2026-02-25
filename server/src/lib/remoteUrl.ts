/**
 * Remote blog URL replacement helper
 *
 * Used on the receiving side: corrects image/resource URLs from remote blogs
 * that use relative paths or incorrect domains (e.g., localhost)
 * to the actual remote blog URL.
 */

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
  fixed = fixed.replace(/(!\[.*?\]\()(\/\/(uploads|img)\/[^)]+\))/g, `$1${remoteSiteUrl}$2`);
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

  const hostname = parsed.hostname;
  const allowLocal = process.env.ALLOW_LOCAL_FEDERATION === "true";

  if (!allowLocal) {
    // Block localhost and loopback
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    ) {
      throw new Error("ERR_LOCALHOST_FORBIDDEN");
    }

    // Block private IP ranges (IPv4)
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    if (
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
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
