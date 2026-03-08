import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/shared/i18n";

interface StickerPickerProps {
  apiKey: string;
  onSelect: (url: string) => void;
  isDark: boolean;
}

interface GiphyImage {
  id: string;
  images: {
    fixed_height_small: { url: string; width: string; height: string };
    original: { url: string };
  };
  title: string;
}

// Debounce delay for search input (ms)
const DEBOUNCE_MS = 300;
const STICKER_LIMIT = 20;

export default function StickerPicker({ apiKey, onSelect, isDark }: StickerPickerProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GiphyImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch stickers from GIPHY API
  const fetchStickers = useCallback(
    async (searchQuery: string) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      try {
        const endpoint = searchQuery.trim()
          ? `https://api.giphy.com/v1/stickers/search?api_key=${apiKey}&q=${encodeURIComponent(searchQuery.trim())}&limit=${STICKER_LIMIT}&rating=g`
          : `https://api.giphy.com/v1/stickers/trending?api_key=${apiKey}&limit=${STICKER_LIMIT}&rating=g`;

        const res = await fetch(endpoint, { signal: controller.signal });
        if (!res.ok) throw new Error("GIPHY API error");
        const json = (await res.json()) as { data?: GiphyImage[] };
        setResults(json.data ?? []);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey],
  );

  // Load trending stickers on mount
  useEffect(() => {
    void fetchStickers("");
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchStickers]);

  // Debounced search on query change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void fetchStickers(query);
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, fetchStickers]);

  return (
    <div
      className={`flex flex-col rounded-lg border shadow-lg ${
        isDark
          ? "border-[var(--color-border)] bg-[var(--color-surface)]"
          : "border-gray-200 bg-white"
      }`}
      style={{ width: 280 }}
    >
      {/* Search input */}
      <div className="p-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder={t("sticker_search_placeholder")}
          className={`w-full rounded-md border px-2.5 py-1.5 text-sm transition-colors outline-none ${
            isDark
              ? "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]"
              : "border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400"
          }`}
          aria-label={t("sticker_search_placeholder")}
        />
      </div>

      {/* Sticker grid */}
      <div
        className="grid gap-1 overflow-y-auto p-2 pt-0"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", maxHeight: 240 }}
      >
        {isLoading && results.length === 0 ? (
          <div className="text-text-secondary col-span-4 py-6 text-center text-xs">
            {t("loading")}
          </div>
        ) : results.length === 0 ? (
          <div className="text-text-secondary col-span-4 py-6 text-center text-xs">
            {t("sticker_search_placeholder")}
          </div>
        ) : (
          results.map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              className="hover:bg-background overflow-hidden rounded transition-colors"
              title={sticker.title}
              onClick={() => {
                onSelect(sticker.images.original.url);
              }}
            >
              <img
                src={sticker.images.fixed_height_small.url}
                alt={sticker.title}
                loading="lazy"
                className="h-[60px] w-full object-contain"
              />
            </button>
          ))
        )}
      </div>

      {/* GIPHY attribution (required by GIPHY ToS) */}
      <div
        className={`border-t px-2 py-1.5 text-center text-[10px] ${
          isDark
            ? "border-[var(--color-border)] text-[var(--color-text-secondary)]"
            : "border-gray-200 text-gray-400"
        }`}
      >
        {t("sticker_powered_by")}
      </div>
    </div>
  );
}
