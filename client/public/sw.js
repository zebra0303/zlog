const CACHE_NAME = "zlog-v1";
const PRECACHE_URLS = ["/", "/site.webmanifest", "/favicons/favicon.svg"];

// Install: 핵심 자산 프리캐시
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: 오래된 캐시 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: 네트워크 우선, 실패 시 캐시 폴백
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // API 요청은 캐시하지 않음
  if (request.url.includes("/api/")) return;

  // POST 등 비-GET 요청은 무시
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 정상 응답이면 캐시에 저장
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 반환
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // HTML 요청이면 오프라인 페이지(index.html) 반환
          if (request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});
