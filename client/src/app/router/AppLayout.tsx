import { useEffect, useCallback, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { Header } from "@/widgets/header/ui/Header";
import { Footer } from "@/widgets/footer/ui/Footer";
import { Sidebar } from "@/widgets/sidebar/ui/Sidebar";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";
import { useThemeStore } from "@/features/toggle-theme/model/store";

const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

/** Render Mermaid diagrams (dynamic import) */
async function renderMermaidBlocks() {
  const blocks = document.querySelectorAll<HTMLElement>(".mermaid-block:not([data-rendered])");
  if (blocks.length === 0) return;

  const isDark = document.documentElement.classList.contains("dark");
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? "dark" : "default",
    securityLevel: "loose",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });

  for (const block of blocks) {
    const code = block.dataset.mermaid;
    if (!code) continue;

    // Use DOMParser for safer HTML entity decoding
    const doc = new DOMParser().parseFromString(code, "text/html");
    const decoded = doc.documentElement.textContent;

    try {
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { svg } = await mermaid.render(id, decoded);
      block.innerHTML = svg;
      block.setAttribute("data-rendered", "true");
    } catch {
      // On render failure, display the raw code as-is
      block.innerHTML = `<pre class="mermaid-error"><code>${decoded.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
      block.setAttribute("data-rendered", "true");
    }
  }
}

export function AppLayout() {
  const { pathname } = useLocation();
  const observerRef = useRef<MutationObserver | null>(null);
  const { getBodyStyle, settings } = useSiteSettingsStore();
  const { isDark } = useThemeStore();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Apply body background, primary color, and CSS variable overrides from settings
  useEffect(() => {
    // Skip if we are in admin page to allow AdminPage's local state to handle live preview
    if (pathname.startsWith("/admin")) return;

    const style = getBodyStyle(isDark);
    document.body.style.background = style.background ?? "";
    document.body.style.backgroundColor = style.backgroundColor ?? "";

    const primaryColor = settings.primary_color;
    if (primaryColor) {
      document.documentElement.style.setProperty("--color-primary", primaryColor);
    } else {
      document.documentElement.style.removeProperty("--color-primary");
    }

    const surfaceColor = isDark ? settings.surface_color_dark : settings.surface_color_light;
    if (surfaceColor) {
      document.documentElement.style.setProperty("--color-surface", surfaceColor);
    } else {
      document.documentElement.style.removeProperty("--color-surface");
    }

    const textColor = isDark ? settings.text_color_dark : settings.text_color_light;
    if (textColor) {
      document.documentElement.style.setProperty("--color-text", textColor);
    } else {
      document.documentElement.style.removeProperty("--color-text");
    }

    return () => {
      document.body.style.background = "";
      document.body.style.backgroundColor = "";
      document.documentElement.style.removeProperty("--color-primary");
      document.documentElement.style.removeProperty("--color-surface");
      document.documentElement.style.removeProperty("--color-text");
    };
  }, [isDark, settings, getBodyStyle, pathname]);

  // Mermaid diagram rendering — detect DOM changes via MutationObserver
  const handleMermaid = useCallback(() => {
    void renderMermaidBlocks();
  }, []);

  useEffect(() => {
    // Initial rendering
    handleMermaid();

    // Detect DOM changes (new mermaid blocks on SPA page transitions)
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.classList.contains("mermaid-block") || node.querySelector(".mermaid-block")) {
              handleMermaid();
              return;
            }
          }
        }
      }
    });
    observerRef.current.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleMermaid]);

  // Re-render mermaid diagrams on theme change
  useEffect(() => {
    const observer = new MutationObserver(() => {
      // Remove data-rendered attribute to trigger re-rendering
      document.querySelectorAll<HTMLElement>(".mermaid-block[data-rendered]").forEach((el) => {
        el.removeAttribute("data-rendered");
      });
      void renderMermaidBlocks();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
    };
  }, []);

  // Code block copy button — global event delegation
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".code-block-copy");
      if (!btn) return;
      const wrapper = btn.closest(".code-block-wrapper");
      if (!wrapper) return;
      const codeEl = wrapper.querySelector("pre code");
      if (!codeEl) return;

      const copied = () => {
        btn.dataset.copied = "true";
        btn.innerHTML = `${CHECK_SVG}<span>Copied!</span>`;
        setTimeout(() => {
          btn.dataset.copied = "";
          btn.innerHTML = COPY_SVG;
        }, 2000);
      };

      navigator.clipboard
        .writeText(codeEl.textContent)
        .then(copied)
        .catch(() => {
          btn.dataset.copied = "";
        });
    };
    document.addEventListener("click", handler);
    return () => {
      document.removeEventListener("click", handler);
    };
  }, []);

  // Mermaid diagram click → fullscreen modal
  useEffect(() => {
    function closeModal() {
      document.getElementById("mermaid-modal")?.remove();
    }

    const handleClick = (e: MouseEvent) => {
      const block = (e.target as HTMLElement).closest<HTMLElement>(".mermaid-block[data-rendered]");
      if (!block) return;

      // Ignore if modal is already open
      if (document.getElementById("mermaid-modal")) return;

      const svg = block.querySelector("svg");
      if (!svg) return;

      const overlay = document.createElement("div");
      overlay.id = "mermaid-modal";
      overlay.className = "mermaid-modal-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay) closeModal();
      });

      const closeBtn = document.createElement("button");
      closeBtn.className = "mermaid-modal-close";
      closeBtn.innerHTML = "&times;";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.addEventListener("click", closeModal);

      const content = document.createElement("div");
      content.className = "mermaid-modal-content";

      // Clone SVG and remove fixed size attributes to scale to modal width
      const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
      const origW = clonedSvg.getAttribute("width");
      const origH = clonedSvg.getAttribute("height");
      // Set viewBox from original width/height if not present
      if (!clonedSvg.getAttribute("viewBox") && origW && origH) {
        const w = parseFloat(origW);
        const h = parseFloat(origH);
        if (w > 0 && h > 0) {
          clonedSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        }
      }
      clonedSvg.removeAttribute("width");
      clonedSvg.removeAttribute("height");
      clonedSvg.style.width = "100%";
      clonedSvg.style.height = "auto";
      content.appendChild(clonedSvg);

      overlay.appendChild(closeBtn);
      overlay.appendChild(content);
      document.body.appendChild(overlay);
      closeBtn.focus();
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  const isEditorPage = pathname.startsWith("/write");
  const isPostDetail = pathname.startsWith("/posts/") || pathname.startsWith("/remote-posts/");
  const hideSidebar = isEditorPage || isPostDetail;

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-lg focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Header />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        <main id="main-content" className="min-w-0 flex-1">
          <Outlet />
        </main>
        {!hideSidebar && (
          <div className="hidden w-72 shrink-0 lg:block">
            <Sidebar />
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
