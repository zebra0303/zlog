import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { User, Upload, Trash2, Plus, Save, KeyRound, Eye, Edit3 } from "lucide-react";
import { Button, Input, Textarea, Card, CardContent, SEOHead, DefaultAvatar } from "@/shared/ui";
import { api } from "@/shared/api/client";
import { useAuthStore } from "@/features/auth/model/store";
import { parseMarkdown } from "@/shared/lib/markdown/parser";
import { useI18n } from "@/shared/i18n";
import { SOCIAL_PLATFORMS } from "@zlog/shared";
import type { ProfileWithStats, UpdateProfileRequest } from "@zlog/shared";

export default function SettingsPage() {
  const { isAuthenticated } = useAuthStore(); const navigate = useNavigate(); const { t } = useI18n();
  const [form, setForm] = useState<UpdateProfileRequest>({}); const [socialLinks, setSocialLinks] = useState<{ platform: string; url: string; label: string }[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null); const [isSaving, setIsSaving] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountMessage, setAccountMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [aboutPreviewMode, setAboutPreviewMode] = useState(false);
  const [aboutHtml, setAboutHtml] = useState("");
  const [isAboutUploading, setIsAboutUploading] = useState(false);
  const aboutTextareaRef = useRef<HTMLTextAreaElement>(null);

  const uploadAndInsertAboutImage = useCallback(async (file: File) => {
    const textarea = aboutTextareaRef.current;
    if (!textarea) return;
    setIsAboutUploading(true);
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = form.aboutMe ?? "";
    const placeholder = `![${t("editor_image_uploading")}](uploading)\n`;
    const before = current.slice(0, start);
    const after = current.slice(end);
    setForm((f) => ({ ...f, aboutMe: before + placeholder + after }));
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api.upload<{ url: string }>("/upload/image", fd);
      const markdown = `![${file.name}](${res.url})\n`;
      setForm((f) => ({ ...f, aboutMe: (f.aboutMe ?? "").replace(placeholder, markdown) }));
    } catch {
      setForm((f) => ({ ...f, aboutMe: (f.aboutMe ?? "").replace(placeholder, "") }));
    } finally {
      setIsAboutUploading(false);
    }
  }, [form.aboutMe, t]);

  const handleAboutPaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await uploadAndInsertAboutImage(file);
        return;
      }
    }
  }, [uploadAndInsertAboutImage]);

  const handleAboutDrop = useCallback(async (e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = e.dataTransfer.files;
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        await uploadAndInsertAboutImage(file);
        return;
      }
    }
  }, [uploadAndInsertAboutImage]);

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
    try { const r = await api.upload<{ avatarUrl: string }>("/profile/avatar", fd); setAvatarPreview(r.avatarUrl); setMessage(t("settings_saved")); } catch (err) { setMessage(err instanceof Error ? err.message : t("upload_failed")); }
  };

  const handleSave = async () => { setIsSaving(true); setMessage(null); try { await api.put("/profile", form); await api.put("/profile/social-links", { links: socialLinks.filter((l) => l.url.trim()) }); setMessage(t("settings_saved")); } catch { setMessage(t("admin_save_failed")); } finally { setIsSaving(false); } };

  const handleAccountSave = async () => {
    setAccountMessage(null);
    if (!currentPassword) { setAccountMessage({ type: "error", text: t("settings_current_password") }); return; }
    if (newPassword && newPassword !== confirmPassword) { setAccountMessage({ type: "error", text: t("settings_password_mismatch") }); return; }
    if (newEmail === currentEmail && !newPassword) return;
    setAccountSaving(true);
    try {
      const payload: { email?: string; currentPassword: string; newPassword?: string } = { currentPassword };
      if (newEmail !== currentEmail) payload.email = newEmail;
      if (newPassword) payload.newPassword = newPassword;
      await api.put("/profile/account", payload);
      setAccountMessage({ type: "success", text: t("settings_account_updated") });
      setCurrentEmail(newEmail);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setAccountMessage({ type: "error", text: err instanceof Error ? err.message : t("request_failed") });
    } finally { setAccountSaving(false); }
  };

  return (
    <div className="flex flex-col gap-6">
      <SEOHead title={t("settings_title")} />
      <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--color-text)]"><User className="h-6 w-6" />{t("settings_title")}</h1><Button onClick={handleSave} disabled={isSaving}><Save className="mr-1 h-4 w-4" />{isSaving ? t("settings_saving") : t("settings_save")}</Button></div>
      {message && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20">{message}</div>}
      <Card><CardContent className="pt-6"><h2 className="mb-4 font-semibold text-[var(--color-text)]">{t("settings_avatar")}</h2>
        <div className="flex items-center gap-4">
          {avatarPreview ? <img src={avatarPreview} alt="" className="h-24 w-24 rounded-full object-cover" /> : <DefaultAvatar size={96} />}
          <div className="flex flex-col gap-2"><label className="cursor-pointer"><input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} /><span className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-background)]"><Upload className="h-4 w-4" />{t("settings_avatar_upload")}</span></label>
          {avatarPreview && <Button variant="destructive" size="sm" onClick={async () => { try { await api.delete("/profile/avatar"); setAvatarPreview(null); } catch { setMessage(t("request_failed")); } }}><Trash2 className="mr-1 h-4 w-4" />{t("delete")}</Button>}
          <p className="text-xs text-[var(--color-text-secondary)]">JPEG, PNG, WebP, GIF (max 5MB)</p></div>
        </div>
      </CardContent></Card>
      <Card><CardContent className="pt-6"><h2 className="mb-4 font-semibold text-[var(--color-text)]">{t("settings_basic_info")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("settings_display_name")}</label><Input value={form.displayName ?? ""} onChange={(e) => { setForm((f) => ({ ...f, displayName: e.target.value })); }} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("settings_bio")}</label><Input value={form.bio ?? ""} onChange={(e) => { setForm((f) => ({ ...f, bio: e.target.value })); }} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("settings_job_title")}</label><Input value={form.jobTitle ?? ""} onChange={(e) => { setForm((f) => ({ ...f, jobTitle: e.target.value })); }} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("settings_company")}</label><Input value={form.company ?? ""} onChange={(e) => { setForm((f) => ({ ...f, company: e.target.value })); }} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("settings_location")}</label><Input value={form.location ?? ""} onChange={(e) => { setForm((f) => ({ ...f, location: e.target.value })); }} /></div>
          <div><label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("settings_blog_title")}</label><Input value={form.blogTitle ?? ""} onChange={(e) => { setForm((f) => ({ ...f, blogTitle: e.target.value })); }} /></div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--color-text)]">{t("settings_about")}</label>
            <div className="flex rounded-lg border border-[var(--color-border)]">
              <button onClick={() => { setAboutPreviewMode(false); }} className={`flex items-center gap-1 px-3 py-1 text-xs ${!aboutPreviewMode ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"} rounded-l-lg`}><Edit3 className="h-3 w-3" />{t("settings_about_edit")}</button>
              <button onClick={async () => { setAboutHtml(await parseMarkdown(form.aboutMe ?? "")); setAboutPreviewMode(true); }} className={`flex items-center gap-1 px-3 py-1 text-xs ${aboutPreviewMode ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"} rounded-r-lg`}><Eye className="h-3 w-3" />{t("settings_about_preview")}</button>
            </div>
          </div>
          {aboutPreviewMode ? (
            <div className="min-h-[160px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              {aboutHtml ? <div className="prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: aboutHtml }} /> : <p className="text-sm text-[var(--color-text-secondary)]">{t("settings_about_empty")}</p>}
            </div>
          ) : (
            <Textarea
              ref={aboutTextareaRef}
              value={form.aboutMe ?? ""}
              onChange={(e) => { setForm((f) => ({ ...f, aboutMe: e.target.value })); }}
              onPaste={handleAboutPaste}
              onDrop={handleAboutDrop}
              onDragOver={(e) => { e.preventDefault(); }}
              rows={6}
              disabled={isAboutUploading}
              placeholder={isAboutUploading ? t("uploading") + "..." : undefined}
            />
          )}
        </div>
      </CardContent></Card>
      <Card><CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-[var(--color-text)]">{t("profile_social_links")}</h2><Button variant="outline" size="sm" onClick={() => { setSocialLinks((p) => [...p, { platform: "website", url: "", label: "" }]); }}><Plus className="mr-1 h-4 w-4" />{t("add")}</Button></div>
        <div className="flex flex-col gap-3">{socialLinks.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={l.platform} onChange={(e) => { setSocialLinks((p) => p.map((x, j) => j === i ? { ...x, platform: e.target.value } : x)); }} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm text-[var(--color-text)]">{Object.entries(SOCIAL_PLATFORMS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select>
            <Input placeholder="URL" value={l.url} onChange={(e) => { setSocialLinks((p) => p.map((x, j) => j === i ? { ...x, url: e.target.value } : x)); }} className="flex-1" />
            <Input placeholder="Label" value={l.label} onChange={(e) => { setSocialLinks((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x)); }} className="w-32" />
            <Button variant="ghost" size="icon" onClick={() => { setSocialLinks((p) => p.filter((_, j) => j !== i)); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
          </div>
        ))}</div>
      </CardContent></Card>

      {/* Account Settings */}
      <Card><CardContent className="pt-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-[var(--color-text)]"><KeyRound className="h-5 w-5" />{t("settings_account")}</h2>
        {accountMessage && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${accountMessage.type === "success" ? "bg-green-50 text-green-600 dark:bg-green-900/20" : "bg-red-50 text-red-600 dark:bg-red-900/20"}`}>{accountMessage.text}</div>
        )}
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("settings_email")}</label>
            <Input type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); }} placeholder="admin@example.com" />
          </div>
          <hr className="border-[var(--color-border)]" />
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("settings_current_password")} <span className="text-red-500">*</span></label>
            <Input type="password" value={currentPassword} onChange={(e) => { setCurrentPassword(e.target.value); }} placeholder="••••••••" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("settings_new_password")}</label>
              <Input type="password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); }} placeholder="••••••••" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">{t("settings_confirm_password")}</label>
              <Input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); }} placeholder="••••••••" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAccountSave} disabled={accountSaving} variant="outline">
              <KeyRound className="mr-1 h-4 w-4" />{accountSaving ? t("loading") : t("settings_update_account")}
            </Button>
          </div>
        </div>
      </CardContent></Card>
    </div>
  );
}
