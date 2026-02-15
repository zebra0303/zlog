import { useEffect, useCallback, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { Header } from "@/widgets/header/ui/Header";
import { Footer } from "@/widgets/footer/ui/Footer";
import { Sidebar } from "@/widgets/sidebar/ui/Sidebar";

const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

/** Mermaid 다이어그램 렌더링 (dynamic import) */
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
    // HTML entity decode
    const decoded = code
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
    try {
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { svg } = await mermaid.render(id, decoded);
      block.innerHTML = svg;
      block.setAttribute("data-rendered", "true");
    } catch {
      // 렌더링 실패 시 코드를 그대로 표시
      block.innerHTML = `<pre class="mermaid-error"><code>${decoded.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
      block.setAttribute("data-rendered", "true");
    }
  }
}

export function AppLayout() {
  const { pathname } = useLocation();
  const observerRef = useRef<MutationObserver | null>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Mermaid 다이어그램 렌더링 — MutationObserver로 DOM 변화 감지
  const handleMermaid = useCallback(() => {
    void renderMermaidBlocks();
  }, []);

  useEffect(() => {
    // 초기 렌더링
    handleMermaid();

    // DOM 변화 감지 (SPA 페이지 전환 시 새로운 mermaid 블록)
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

  // 테마 변경 시 mermaid 다이어그램 재렌더링
  useEffect(() => {
    const observer = new MutationObserver(() => {
      // data-rendered 속성 제거하여 재렌더링 트리거
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

  // 코드블록 복사 버튼 — 전역 이벤트 위임
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

  // Mermaid 다이어그램 클릭 → 전체화면 모달
  useEffect(() => {
    function closeModal() {
      document.getElementById("mermaid-modal")?.remove();
    }

    const handleClick = (e: MouseEvent) => {
      const block = (e.target as HTMLElement).closest<HTMLElement>(".mermaid-block[data-rendered]");
      if (!block) return;

      // 이미 모달이 열려 있으면 무시
      if (document.getElementById("mermaid-modal")) return;

      const svg = block.querySelector("svg");
      if (!svg) return;

      const overlay = document.createElement("div");
      overlay.id = "mermaid-modal";
      overlay.className = "mermaid-modal-overlay";
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

      // SVG를 복제하고 고정 크기 속성을 제거하여 모달 너비에 맞춰 확대
      const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
      const origW = clonedSvg.getAttribute("width");
      const origH = clonedSvg.getAttribute("height");
      // viewBox가 없으면 원본 width/height로 설정
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
  const isPostDetail = pathname.startsWith("/posts/");
  const hideSidebar = isEditorPage || isPostDetail;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        <main className="min-w-0 flex-1">
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
