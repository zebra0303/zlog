import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { User, Upload, Trash2, Plus, Save, KeyRound, Eye, Edit3 } from "lucide-react";
import { Button, Input, Textarea, Card, CardContent, SEOHead, DefaultAvatar } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/model/store";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { SOCIAL_PLATFORMS } from "@zlog/shared";
import type { ProfileWithStats, UpdateProfileRequest } from "@zlog/shared";

export default function SettingsPage() {
  const { isAuthenticated } = useAuthStore(); const navigate = useNavigate();
  const [form, setForm] = useState<UpdateProfileRequest>({}); const [socialLinks, setSocialLinks] = useState<Array<{ platform: string; url: string; label: string }>>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null); const [isSaving, setIsSaving] = useState(false); const [message, setMessage] = useState<string | null>(null);
  // 계정 설정
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountMessage, setAccountMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // 자기소개 미리보기
  const [aboutPreviewMode, setAboutPreviewMode] = useState(false);
  const [aboutHtml, setAboutHtml] = useState("");

  useEffect(() => { if (!isAuthenticated) { void navigate("/login"); return; }
    void api.get<ProfileWithStats & { email?: string }>("/profile").then((d) => {
      setForm({ displayName: d.displayName, bio: d.bio ?? "", aboutMe: d.aboutMe ?? "", jobTitle: d.jobTitle ?? "", company: d.company ?? "", location: d.location ?? "", blogTitle: d.blogTitle ?? "", blogDescription: d.blogDescription ?? "" });
      setSocialLinks(d.socialLinks.map((l) => ({ platform: l.platform, url: l.url, label: l.label ?? "" })));
      setAvatarPreview(d.avatarUrl);
      if (d.email) { setCurrentEmail(d.email); setNewEmail(d.email); }
    });
  }, [isAuthenticated, navigate]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("avatar", file);
    try { const r = await api.upload<{ avatarUrl: string }>("/profile/avatar", fd); setAvatarPreview(r.avatarUrl); setMessage("아바타가 업로드되었습니다."); } catch (err) { setMessage(err instanceof Error ? err.message : "업로드 실패"); }
  };

  const handleSave = async () => { setIsSaving(true); setMessage(null); try { await api.put("/profile", form); await api.put("/profile/social-links", { links: socialLinks.filter((l) => l.url.trim()) }); setMessage("프로필이 저장되었습니다."); } catch { setMessage("저장에 실패했습니다."); } finally { setIsSaving(false); } };

  const handleAccountSave = async () => {
    setAccountMessage(null);
    if (!currentPassword) { setAccountMessage({ type: "error", text: "현재 비밀번호를 입력해주세요." }); return; }
    if (newPassword && newPassword !== confirmPassword) { setAccountMessage({ type: "error", text: "새 비밀번호가 일치하지 않습니다." }); return; }
    if (newPassword && newPassword.length < 8) { setAccountMessage({ type: "error", text: "새 비밀번호는 최소 8자 이상이어야 합니다." }); return; }
    if (newEmail === currentEmail && !newPassword) { setAccountMessage({ type: "error", text: "변경할 내용이 없습니다." }); return; }

    setAccountSaving(true);
    try {
      const payload: { email?: string; currentPassword: string; newPassword?: string } = { currentPassword };
      if (newEmail !== currentEmail) payload.email = newEmail;
      if (newPassword) payload.newPassword = newPassword;
      await api.put("/profile/account", payload);
      setAccountMessage({ type: "success", text: "계정 정보가 변경되었습니다." });
      setCurrentEmail(newEmail);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setAccountMessage({ type: "error", text: err instanceof Error ? err.message : "변경에 실패했습니다." });
    } finally { setAccountSaving(false); }
  };

  return (
    <div className="flex flex-col gap-6">
      <SEOHead title="프로필 설정" />
      <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--color-text)]"><User className="h-6 w-6" />프로필 설정</h1><Button onClick={handleSave} disabled={isSaving}><Save className="mr-1 h-4 w-4" />{isSaving ? "저장 중..." : "저장"}</Button></div>
      {message && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20">{message}</div>}
      <Card><CardContent className="pt-6"><h2 className="mb-4 font-semibold text-[var(--color-text)]">프로필 이미지</h2>
        <div className="flex items-center gap-4">
          {avatarPreview ? <img src={avatarPreview} alt="아바타" className="h-24 w-24 rounded-full object-cover" /> : <DefaultAvatar size={96} />}
          <div className="flex flex-col gap-2"><label className="cursor-pointer"><input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} /><span className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-background)]"><Upload className="h-4 w-4" />이미지 업로드</span></label>
          {avatarPreview && <Button variant="destructive" size="sm" onClick={async () => { try { await api.delete("/profile/avatar"); setAvatarPreview(null); } catch {} }}><Trash2 className="mr-1 h-4 w-4" />삭제</Button>}
          <p className="text-xs text-[var(--color-text-secondary)]">JPEG, PNG, WebP, GIF (최대 5MB)</p></div>
        </div>
      </CardContent></Card>
      <Card><CardContent className="pt-6"><h2 className="mb-4 font-semibold text-[var(--color-text)]">기본 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">표시 이름</label><Input value={form.displayName ?? ""} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">한 줄 소개</label><Input value={form.bio ?? ""} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">직함</label><Input value={form.jobTitle ?? ""} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">소속</label><Input value={form.company ?? ""} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">활동 지역</label><Input value={form.location ?? ""} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">블로그 제목</label><Input value={form.blogTitle ?? ""} onChange={(e) => setForm((f) => ({ ...f, blogTitle: e.target.value }))} /></div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--color-text)]">상세 자기소개 (마크다운)</label>
            <div className="flex rounded-lg border border-[var(--color-border)]">
              <button onClick={() => setAboutPreviewMode(false)} className={`flex items-center gap-1 px-3 py-1 text-xs ${!aboutPreviewMode ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"} rounded-l-lg`}><Edit3 className="h-3 w-3" />편집</button>
              <button onClick={async () => { setAboutHtml(await parseMarkdown(form.aboutMe ?? "")); setAboutPreviewMode(true); }} className={`flex items-center gap-1 px-3 py-1 text-xs ${aboutPreviewMode ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"} rounded-r-lg`}><Eye className="h-3 w-3" />미리보기</button>
            </div>
          </div>
          {aboutPreviewMode ? (
            <div className="min-h-[160px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              {aboutHtml ? <div className="prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: aboutHtml }} /> : <p className="text-sm text-[var(--color-text-secondary)]">내용이 없습니다.</p>}
            </div>
          ) : (
            <Textarea value={form.aboutMe ?? ""} onChange={(e) => setForm((f) => ({ ...f, aboutMe: e.target.value }))} rows={6} />
          )}
        </div>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-[var(--color-text)]">소셜 링크</h2><Button variant="outline" size="sm" onClick={() => setSocialLinks((p) => [...p, { platform: "website", url: "", label: "" }])}><Plus className="mr-1 h-4 w-4" />추가</Button></div>
        <div className="flex flex-col gap-3">{socialLinks.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={l.platform} onChange={(e) => setSocialLinks((p) => p.map((x, j) => j === i ? { ...x, platform: e.target.value } : x))} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm text-[var(--color-text)]">{Object.entries(SOCIAL_PLATFORMS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select>
            <Input placeholder="URL" value={l.url} onChange={(e) => setSocialLinks((p) => p.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} className="flex-1" />
            <Input placeholder="레이블" value={l.label} onChange={(e) => setSocialLinks((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className="w-32" />
            <Button variant="ghost" size="icon" onClick={() => setSocialLinks((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-500" /></Button>
          </div>
        ))}</div>
      </CardContent></Card>

      {/* 계정 설정 */}
      <Card><CardContent className="pt-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-[var(--color-text)]"><KeyRound className="h-5 w-5" />계정 설정</h2>
        {accountMessage && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${accountMessage.type === "success" ? "bg-green-50 text-green-600 dark:bg-green-900/20" : "bg-red-50 text-red-600 dark:bg-red-900/20"}`}>{accountMessage.text}</div>
        )}
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">이메일</label>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <hr className="border-[var(--color-border)]" />
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">현재 비밀번호 <span className="text-red-500">*</span></label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="현재 비밀번호를 입력하세요" />
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">이메일이나 비밀번호를 변경하려면 현재 비밀번호를 입력해야 합니다.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">새 비밀번호</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="변경하지 않으려면 비워두세요" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">새 비밀번호 확인</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="새 비밀번호를 다시 입력하세요" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAccountSave} disabled={accountSaving} variant="outline">
              <KeyRound className="mr-1 h-4 w-4" />{accountSaving ? "변경 중..." : "계정 정보 저장"}
            </Button>
          </div>
        </div>
      </CardContent></Card>
    </div>
  );
}
