import { useState } from "react";
import { useNavigate } from "react-router";
import { LogIn } from "lucide-react";
import { Button, Input, Card, CardContent, CardHeader, SEOHead, ZlogLogo } from "@/shared/ui";
import { useAuthStore } from "@/features/auth/model/store";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setError(null);
    try { await login(email, password); void navigate("/"); }
    catch (err) { setError(err instanceof Error ? err.message : "로그인에 실패했습니다."); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <SEOHead title="로그인" />
      <Card className="w-full max-w-md">
        <CardHeader><div className="flex flex-col items-center gap-3"><ZlogLogo size={64} /><h1 className="text-2xl font-bold text-[var(--color-text)]">관리자 로그인</h1><p className="text-sm text-[var(--color-text-secondary)]">블로그를 관리하려면 로그인하세요.</p></div></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">이메일</label><Input type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
            <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">비밀번호</label><Input type="password" placeholder="비밀번호를 입력하세요" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">{error}</div>}
            <Button type="submit" disabled={isLoading} className="w-full"><LogIn className="mr-2 h-4 w-4" />{isLoading ? "로그인 중..." : "로그인"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
