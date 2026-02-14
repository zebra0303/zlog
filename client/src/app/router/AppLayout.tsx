import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { Header } from "@/widgets/header/ui/Header";
import { Footer } from "@/widgets/footer/ui/Footer";
import { Sidebar } from "@/widgets/sidebar/ui/Sidebar";

export function AppLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

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
