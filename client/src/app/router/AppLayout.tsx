import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { Header } from "@/widgets/header/ui/Header";
import { Footer } from "@/widgets/footer/ui/Footer";
import { Sidebar } from "@/widgets/sidebar/ui/Sidebar";

const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

export function AppLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  // 코드블록 복사 버튼 — 전역 이벤트 위임
  useEffect(() => {
    const handler = async (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".code-block-copy");
      if (!btn) return;
      const wrapper = btn.closest(".code-block-wrapper");
      if (!wrapper) return;
      const codeEl = wrapper.querySelector("pre code");
      if (!codeEl) return;

      try {
        await navigator.clipboard.writeText(codeEl.textContent ?? "");
        btn.dataset.copied = "true";
        btn.innerHTML = `${CHECK_SVG}<span>Copied!</span>`;
        setTimeout(() => {
          btn.dataset.copied = "";
          btn.innerHTML = COPY_SVG;
        }, 2000);
      } catch {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = codeEl.textContent ?? "";
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        btn.dataset.copied = "true";
        btn.innerHTML = `${CHECK_SVG}<span>Copied!</span>`;
        setTimeout(() => {
          btn.dataset.copied = "";
          btn.innerHTML = COPY_SVG;
        }, 2000);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        <main className="min-w-0 flex-1"><Outlet /></main>
        <div className="hidden w-72 shrink-0 lg:block"><Sidebar /></div>
      </div>
      <Footer />
    </div>
  );
}
