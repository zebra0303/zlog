const CACHE_NAME = "zlog-v2";
const API_CACHE_NAME = "zlog-api-v1";
const PRECACHE_URLS = ["/", "/favicons/favicon.svg"];
const API_CACHE_MAX = 50;

// Cacheable GET API patterns for stale-while-revalidate
const CACHEABLE_API_PATTERNS = [
  /^\/api\/posts(\?|$)/, // Post list (pagination, category, tag)
  /^\/api\/posts\/[^/]+/, // Individual post detail
  /^\/api\/categories(\?|$)/, // Category list
];

// Trim cache to max entries (LRU: oldest first)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
  }
}

// Fetch from network and update API cache
async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(API_CACHE_NAME);
    await cache.put(request, response.clone());
    trimCache(API_CACHE_NAME, API_CACHE_MAX);
  }
  return response;
}

// Stale-while-revalidate for cacheable API requests
async function handleApiRequest(request, event) {
  const cache = await caches.open(API_CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    // Background revalidate — update cache for next visit
    event.waitUntil(fetchAndCache(request).catch(() => {}));
    return cached;
  }

  // No cache — try network
  try {
    return await fetchAndCache(request);
  } catch {
    // Offline with no cache — return 503 JSON
    return new Response(JSON.stringify({ error: "Offline", message: "No cached data available" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Install: precache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

// Activate: clean up old caches (keep current static + API caches)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// Fetch: route API vs static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests
  if (url.pathname.startsWith("/api/")) {
    // If Mutation (POST/PUT/DELETE), invalidate the whole API cache so that the next GET gets fresh data
    if (["POST", "PUT", "DELETE"].includes(request.method)) {
      event.waitUntil(caches.delete(API_CACHE_NAME).catch(() => {}));
      // Passthrough to network
      return;
    }

    if (request.method === "GET") {
      if (CACHEABLE_API_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
        event.respondWith(handleApiRequest(request, event));
      }
      return;
    }

    return;
  }

  // Only handle GET requests for static assets
  if (request.method !== "GET") return;

  // Static assets: network-first with cache fallback (unchanged)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // HTML requests fall back to cached index.html (SPA shell)
          if (request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/");
          }
          return new Response("Offline", { status: 503 });
        });
      }),
  );
});
