/**
 * 원격 블로그 URL 치환 헬퍼
 *
 * 수신 측에서 사용: 원격 블로그의 이미지/리소스 URL이
 * 상대 경로이거나 잘못된 도메인(localhost 등)인 경우
 * 실제 원격 블로그 URL로 교정합니다.
 */

/** 단일 URL의 도메인을 실제 원격 블로그 URL로 치환 */
export function fixRemoteUrl(url: string | null, remoteSiteUrl: string): string | null {
  if (!url) return url;
  if (url.startsWith("/")) return remoteSiteUrl + url;
  return url.replace(/^https?:\/\/[^/]+(\/(uploads|img)\/)/, `${remoteSiteUrl}$1`);
}

/**
 * content 내 이미지 URL의 도메인을 실제 원격 블로그 URL로 치환
 * - 상대 경로: /uploads/... → remoteSiteUrl/uploads/...
 * - 잘못된 도메인: http://localhost/uploads/... → remoteSiteUrl/uploads/...
 * - 마크다운 ![...](...) 및 HTML <img src="..."> 모두 처리
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
