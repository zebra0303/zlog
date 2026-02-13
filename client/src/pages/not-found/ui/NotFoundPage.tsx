import { Link } from "react-router";
import { Home } from "lucide-react";
import { Button, ZlogLogo, SEOHead } from "@/shared/ui";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <SEOHead title="404 - 페이지를 찾을 수 없습니다" />
      <ZlogLogo size={96} />
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[var(--color-primary)]">404</h1>
        <p className="mt-2 text-xl text-[var(--color-text)]">페이지를 찾을 수 없습니다</p>
        <p className="mt-1 text-[var(--color-text-secondary)]">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
      </div>
      <Button asChild><Link to="/"><Home className="mr-2 h-4 w-4" />홈으로 돌아가기</Link></Button>
    </div>
  );
}
