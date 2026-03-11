"use client";

import { useCallback, useEffect, useState } from "react";

type Session = { authenticated: boolean };
type RedirectEntry = { slug: string; targetUrl: string; name: string; note: string };
type Settings = { redirects: RedirectEntry[]; canEdit: boolean; scanCounts: Record<string, number> };
type SlugStats = {
  totalScans: number;
  last24h: number;
  last7d: number;
  last30d: number;
  uniqueIPs: number;
  topCountries: { code: string; count: number }[];
  topDevices: { device: string; count: number }[];
  topReferers: { referer: string; count: number }[];
  dailyTrend: { date: string; count: number }[];
  recentScans: {
    scannedAt: string;
    ip?: string;
    userAgent?: string;
    referer?: string;
    country?: string;
  }[];
};

function parseUA(ua: string): string {
  if (ua.length <= 60) return ua;
  const match = ua.match(/(iPhone|iPad|Android|Windows|Mac OS X|Linux)[^)]*/)
    ?? ua.match(/([A-Za-z]+\/[\d.]+)/);
  return match ? match[0] : ua.slice(0, 60) + "...";
}

function fullRedirectUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || (
    typeof window !== "undefined" ? window.location.origin : ""
  );
  return base.replace(/\/+$/, "") + "/go/" + encodeURIComponent(slug);
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [code, setCode] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [slugStats, setSlugStats] = useState<SlugStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      setSession(data);
    } catch {
      setSession({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.status === 401) {
        setSession({ authenticated: false });
        return;
      }
      const data = await res.json();
      setSettings({
        redirects: Array.isArray(data.redirects) ? data.redirects : [],
        canEdit: data.canEdit === true,
        scanCounts: data.scanCounts && typeof data.scanCounts === "object" ? data.scanCounts : {},
      });
    } catch {
      setError("Failed to load settings / 加载设置失败");
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (session?.authenticated) fetchSettings();
  }, [session?.authenticated, fetchSettings]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed / 登录失败");
        return;
      }
      setCode("");
      await fetchSession();
    } catch {
      setError("Request failed / 请求失败");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession({ authenticated: false });
    setSettings(null);
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings?.canEdit) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: newSlug.trim(),
          targetUrl: newUrl.trim(),
          name: newName.trim(),
          note: newNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed / 保存失败");
        return;
      }
      setMessage("Link saved. / 链接已保存。");
      setNewSlug("");
      setNewUrl("");
      setNewName("");
      setNewNote("");
      setEditingSlug(null);
      await fetchSettings();
    } catch {
      setError("Request failed / 请求失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!settings?.canEdit) return;
    if (!confirm("Delete this link? / 确定删除此链接?")) return;
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Delete failed / 删除失败");
        return;
      }
      await fetchSettings();
    } catch {
      setError("Request failed / 请求失败");
    }
  };

  const handleEdit = (entry: RedirectEntry) => {
    setNewSlug(entry.slug);
    setNewUrl(entry.targetUrl);
    setNewName(entry.name);
    setNewNote(entry.note);
    setEditingSlug(entry.slug);
    setError(null);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setNewSlug("");
    setNewUrl("");
    setNewName("");
    setNewNote("");
    setEditingSlug(null);
  };

  const openPreview = async (slug: string) => {
    setPreviewSlug(slug);
    setSlugStats(null);
    setLoadingStats(true);
    try {
      const res = await fetch("/api/stats?slug=" + encodeURIComponent(slug));
      if (res.ok) {
        const data = await res.json();
        setSlugStats(data);
      }
    } catch {
      // Non-critical; modal still shows QR code
    } finally {
      setLoadingStats(false);
    }
  };

  const closePreview = () => {
    setPreviewSlug(null);
    setSlugStats(null);
  };

  const downloadQr = async (slug: string) => {
    try {
      const res = await fetch("/api/qr?slug=" + encodeURIComponent(slug));
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qr-" + slug + ".png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed / 下载失败");
    }
  };

  /* --- Loading --- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-900">
        <p className="text-stone-500">Loading... / 载入中...</p>
      </div>
    );
  }

  /* --- Login --- */
  if (!session?.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-900 px-4">
        <div className="w-full max-w-sm bg-stone-800 rounded-xl shadow-lg border border-stone-700 p-6">
          <div className="flex justify-center mb-4">
            <img src="/flywing-logo.jpg" alt="Logo" className="h-10 rounded" />
          </div>
          <h1 className="text-xl font-semibold text-stone-100 mb-1">Sign in / 登录</h1>
          <p className="text-sm text-stone-400 mb-5">
            Enter the 6-digit code from your authenticator app. / 输入验证器应用中的6位数字码。
          </p>
          {error && (
            <div className="mb-4 rounded-lg bg-rose-900/40 border border-rose-800 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin}>
            <label htmlFor="code" className="block text-sm font-medium text-stone-400 mb-1">
              Code / 验证码
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-lg border border-stone-600 bg-stone-700 text-stone-100 px-3 py-2 text-base tracking-widest
                         placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent mb-4"
            />
            <button
              type="submit"
              disabled={saving || code.length !== 6}
              className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white
                         hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Verifying... / 验证中..." : "Sign in / 登录"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* --- Dashboard --- */
  const entries = settings?.redirects ?? [];
  const canEdit = settings?.canEdit === true;
  const previewEntry = entries.find((e) => e.slug === previewSlug);

  return (
    <div className="min-h-screen bg-stone-900 px-4 py-8 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img src="/flywing-logo.jpg" alt="Logo" className="h-12 rounded" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-100">QR Redirect / 二维码跳转</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-stone-400 hover:text-stone-200 transition-colors"
          >
            Sign out / 登出
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="rounded-lg bg-rose-900/40 border border-rose-800 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg bg-emerald-900/40 border border-emerald-800 px-4 py-3 text-sm text-emerald-300">
            {message}
          </div>
        )}

        {/* Add link form */}
        {canEdit && (
          <div className="bg-stone-800 rounded-xl shadow-lg border border-stone-700 p-5">
            <h2 className="text-sm font-semibold text-stone-100 mb-0.5">
              {editingSlug ? `Editing / 编辑: ${editingSlug}` : "Add new link / 新增链接"}
            </h2>
            <p className="text-xs text-stone-400 mb-4">
              {editingSlug ? "Change the URL, name, or note below. / 修改下方的网址、名称或备注。" : "Create a new short link with its own QR code. / 创建新的短链接及其专属二维码。"}
            </p>
            <form onSubmit={handleAddLink} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
                <div>
                  <label htmlFor="newSlug" className="block text-xs font-medium text-stone-400 mb-1">
                    Slug / 短标识
                  </label>
                  <input
                    id="newSlug"
                    type="text"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                    placeholder="e.g. ig"
                    maxLength={10}
                    readOnly={!!editingSlug}
                    className={`w-full rounded-lg border border-stone-600 bg-stone-700 text-stone-100 px-3 py-2 text-sm
                               placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                               ${editingSlug ? "bg-stone-800 text-stone-500 cursor-not-allowed" : ""}`}
                  />
                </div>
                <div>
                  <label htmlFor="newUrl" className="block text-xs font-medium text-stone-400 mb-1">
                    Redirect URL / 跳转地址
                  </label>
                  <input
                    id="newUrl"
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-stone-600 bg-stone-700 text-stone-100 px-3 py-2 text-sm
                               placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="newName" className="block text-xs font-medium text-stone-400 mb-1">
                    Name / 名称
                  </label>
                  <input
                    id="newName"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Instagram"
                    maxLength={500}
                    className="w-full rounded-lg border border-stone-600 bg-stone-700 text-stone-100 px-3 py-2 text-sm
                               placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="newNote" className="block text-xs font-medium text-stone-400 mb-1">
                    Note / 备注
                  </label>
                  <input
                    id="newNote"
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="e.g. Printed on product box"
                    maxLength={500}
                    className="w-full rounded-lg border border-stone-600 bg-stone-700 text-stone-100 px-3 py-2 text-sm
                               placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !newSlug.trim() || !newUrl.trim()}
                  className="rounded-lg bg-stone-600 px-5 py-2 text-sm font-medium text-white
                             hover:bg-stone-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? "Saving... / 保存中..." : editingSlug ? "Update / 更新" : "Add / 添加"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-lg bg-stone-700 px-5 py-2 text-sm font-medium text-stone-300
                             hover:bg-stone-600 transition-colors"
                >
                  {editingSlug ? "Cancel / 取消" : "Clear / 清除"}
                </button>
              </div>
            </form>
          </div>
        )}

        {!canEdit && (
          <div className="rounded-lg bg-sky-900/30 border border-sky-800 px-4 py-3 text-sm text-sky-300">
            Add Supabase to create or edit links from the UI. / 请接入 Supabase 以在界面中创建或编辑链接。
          </div>
        )}

        {/* Links table */}
        <div className="bg-stone-800 rounded-xl shadow-lg border border-stone-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-700">
            <h2 className="text-sm font-semibold text-stone-100">Links / 链接列表</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Each link has a short path. Scan the QR or open the full URL to redirect. / 每个链接对应一个短路径，扫码或打开完整URL即可跳转。
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-stone-500">
              No links yet. / 暂无链接。{canEdit ? " Add one above. / 请在上方添加。" : " Connect Supabase to get started. / 请接入 Supabase 开始使用。"}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-750 text-left text-xs font-medium text-stone-400 uppercase tracking-wider" style={{ backgroundColor: "rgb(41 37 36)" }}>
                      <th className="px-3 py-3">QR / 二维码</th>
                      <th className="px-3 py-3">Slug / 标识</th>
                      <th className="px-5 py-3">Name / 名称</th>
                      <th className="px-5 py-3">Full URL / 完整地址</th>
                      <th className="px-5 py-3">Redirects to / 跳转至</th>
                      <th className="px-5 py-3">Note / 备注</th>
                      <th className="px-3 py-3 text-right">Usage / 使用次数</th>
                      <th className="px-3 py-3 text-right">Actions / 操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-700">
                    {entries.map((entry) => (
                      <tr key={entry.slug} className="hover:bg-white/5 transition-colors">
                        <td className="px-3 py-3">
                          <img
                            src={"/api/qr?slug=" + encodeURIComponent(entry.slug)}
                            alt={"QR " + entry.slug}
                            width={40}
                            height={40}
                            className="rounded cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => openPreview(entry.slug)}
                          />
                        </td>
                        <td className="px-3 py-3 font-medium text-stone-200 whitespace-nowrap">
                          {entry.slug}
                        </td>
                        <td className="px-5 py-3 text-stone-300 whitespace-nowrap">
                          {entry.name || <span className="text-stone-600">--</span>}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <a
                            href={fullRedirectUrl(entry.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-400 hover:text-teal-300 hover:underline"
                          >
                            {fullRedirectUrl(entry.slug)}
                          </a>
                        </td>
                        <td className="px-5 py-3 max-w-xs truncate text-stone-400">
                          <a
                            href={entry.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-stone-300 hover:underline"
                            title={entry.targetUrl}
                          >
                            {entry.targetUrl}
                          </a>
                        </td>
                        <td className="px-5 py-3 text-stone-500 text-xs" title={entry.note}>
                          <span className="line-clamp-2">{entry.note || <span className="text-stone-600">--</span>}</span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openPreview(entry.slug)}
                            className="tabular-nums text-teal-400 hover:text-teal-300 hover:underline cursor-pointer text-xs"
                            title="View scan details / 查看扫描详情"
                          >
                            {settings?.scanCounts?.[entry.slug] ?? 0}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openPreview(entry.slug)}
                              className="p-1.5 rounded-md text-teal-400 hover:text-teal-300 hover:bg-teal-900/40 transition-colors"
                              title="Stats / 统计"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 16.5 2h-1ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9A1.5 1.5 0 0 0 9.5 18h1a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 10.5 6h-1ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5A1.5 1.5 0 0 0 3.5 18h1A1.5 1.5 0 0 0 6 16.5v-5A1.5 1.5 0 0 0 4.5 10h-1Z" />
                              </svg>
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleEdit(entry)}
                                className="p-1.5 rounded-md text-amber-400 hover:text-amber-300 hover:bg-amber-900/40 transition-colors"
                                title="Edit / 编辑"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                  <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                                </svg>
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleDelete(entry.slug)}
                                className="p-1.5 rounded-md text-red-400 hover:text-red-300 hover:bg-red-900/40 transition-colors"
                                title="Delete / 删除"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.798l-.35 5.5a.75.75 0 0 1-1.497-.095l.35-5.5a.75.75 0 0 1 .797-.703Zm2.84 0a.75.75 0 0 1 .798.703l.35 5.5a.75.75 0 0 1-1.498.095l-.35-5.5a.75.75 0 0 1 .7-.798Z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-stone-700">
                {entries.map((entry) => (
                  <div key={entry.slug} className="px-4 py-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <img
                        src={"/api/qr?slug=" + encodeURIComponent(entry.slug)}
                        alt={"QR " + entry.slug}
                        width={56}
                        height={56}
                        className="rounded cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                        onClick={() => openPreview(entry.slug)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-100 text-sm">{entry.slug}</span>
                          {entry.name && (
                            <span className="text-stone-400 text-xs truncate">{entry.name}</span>
                          )}
                        </div>
                        <a
                          href={entry.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-stone-400 hover:text-stone-300 hover:underline block truncate mt-0.5"
                          title={entry.targetUrl}
                        >
                          {entry.targetUrl}
                        </a>
                        <div className="flex items-center gap-3 mt-1">
                          <button
                            type="button"
                            onClick={() => openPreview(entry.slug)}
                            className="text-xs text-teal-400 hover:underline tabular-nums"
                          >
                            {settings?.scanCounts?.[entry.slug] ?? 0} scans / 次扫描
                          </button>
                          {entry.note && (
                            <span className="text-[11px] text-stone-500 truncate">{entry.note}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openPreview(entry.slug)}
                        className="p-2 rounded-md text-teal-400 hover:text-teal-300 hover:bg-teal-900/40 transition-colors"
                        title="Stats / 统计"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5">
                          <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 16.5 2h-1ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9A1.5 1.5 0 0 0 9.5 18h1a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 10.5 6h-1ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5A1.5 1.5 0 0 0 3.5 18h1A1.5 1.5 0 0 0 6 16.5v-5A1.5 1.5 0 0 0 4.5 10h-1Z" />
                        </svg>
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleEdit(entry)}
                          className="p-2 rounded-md text-amber-400 hover:text-amber-300 hover:bg-amber-900/40 transition-colors"
                          title="Edit / 编辑"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5">
                            <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                          </svg>
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.slug)}
                          className="p-2 rounded-md text-red-400 hover:text-red-300 hover:bg-red-900/40 transition-colors"
                          title="Delete / 删除"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.798l-.35 5.5a.75.75 0 0 1-1.497-.095l.35-5.5a.75.75 0 0 1 .797-.703Zm2.84 0a.75.75 0 0 1 .798.703l.35 5.5a.75.75 0 0 1-1.498.095l-.35-5.5a.75.75 0 0 1 .7-.798Z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* QR Preview Modal */}
        {previewSlug && previewEntry && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={closePreview}
          >
            <div
              className="bg-stone-800 rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-stone-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-100">
                  {previewEntry.name || previewEntry.slug}
                </h3>
                <button
                  type="button"
                  onClick={closePreview}
                  className="text-stone-500 hover:text-stone-300 text-lg leading-none"
                >
                  x
                </button>
              </div>
              <img
                src={"/api/qr?slug=" + encodeURIComponent(previewSlug)}
                alt={"QR " + previewSlug}
                className="mx-auto"
                width={256}
                height={256}
              />
              <p className="text-xs text-center text-stone-400 break-all">
                {fullRedirectUrl(previewSlug)}
              </p>
              <button
                type="button"
                onClick={() => downloadQr(previewSlug)}
                className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white
                           hover:bg-teal-500 transition-colors"
              >
                Download PNG / 下载图片
              </button>

              {/* Scan analytics */}
              <div className="border-t border-stone-700 pt-4 space-y-4">
                <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  Scan analytics / 扫描统计
                </h4>
                {loadingStats ? (
                  <p className="text-xs text-stone-500">Loading stats... / 加载统计数据...</p>
                ) : slugStats ? (
                  <>
                    {/* Counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      {[
                        { label: "Total / 总计", value: slugStats.totalScans },
                        { label: "24h / 今日", value: slugStats.last24h },
                        { label: "7 days / 7天", value: slugStats.last7d },
                        { label: "30 days / 30天", value: slugStats.last30d },
                      ].map((s) => (
                        <div key={s.label} className="bg-stone-700 rounded-lg p-2">
                          <div className="text-lg font-semibold text-stone-100 tabular-nums">{s.value}</div>
                          <div className="text-[10px] text-stone-400 uppercase">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Unique visitors */}
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-stone-400">Unique visitors (30d) / 独立访客 (30天)</span>
                      <span className="font-medium text-stone-100 tabular-nums">{slugStats.uniqueIPs}</span>
                    </div>

                    {/* Daily trend bar chart */}
                    {slugStats.dailyTrend.length > 0 && (() => {
                      const maxCount = Math.max(...slugStats.dailyTrend.map((d) => d.count), 1);
                      return (
                        <div>
                          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-2">
                            Daily scans (last 30 days) / 每日扫描 (近30天)
                          </p>
                          <div className="flex items-end gap-[2px] h-16">
                            {slugStats.dailyTrend.map((d) => (
                              <div
                                key={d.date}
                                className="flex-1 bg-teal-500 rounded-t-sm hover:bg-teal-400 transition-colors cursor-default min-w-[3px]"
                                style={{ height: `${Math.max((d.count / maxCount) * 100, d.count > 0 ? 8 : 2)}%` }}
                                title={`${d.date}: ${d.count} scan${d.count !== 1 ? "s" : ""}`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[9px] text-stone-500 mt-1">
                            <span>{slugStats.dailyTrend[0]?.date.slice(5)}</span>
                            <span>{slugStats.dailyTrend[slugStats.dailyTrend.length - 1]?.date.slice(5)}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Top countries */}
                    {slugStats.topCountries.length > 0 && (
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1.5">
                          Top countries (30d) / 热门国家 (30天)
                        </p>
                        <div className="space-y-1">
                          {slugStats.topCountries.map((c) => (
                            <div key={c.code} className="flex items-center justify-between text-xs">
                              <span className="text-stone-300 uppercase font-medium">{c.code}</span>
                              <div className="flex items-center gap-2 flex-1 mx-3">
                                <div className="flex-1 bg-stone-700 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-teal-500 h-full rounded-full"
                                    style={{ width: `${(c.count / (slugStats.topCountries[0]?.count || 1)) * 100}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-stone-400 tabular-nums">{c.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Device breakdown */}
                    {slugStats.topDevices.length > 0 && (
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1.5">
                          Devices (30d) / 设备分布 (30天)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {slugStats.topDevices.map((d) => (
                            <span key={d.device} className="inline-flex items-center gap-1 bg-stone-700 rounded-md px-2 py-1 text-xs">
                              <span className="text-stone-300 font-medium">{d.device}</span>
                              <span className="text-stone-500 tabular-nums">{d.count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top referers */}
                    {slugStats.topReferers.length > 0 && (
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1.5">
                          Top referers (30d) / 热门来源 (30天)
                        </p>
                        <div className="space-y-1">
                          {slugStats.topReferers.map((r) => (
                            <div key={r.referer} className="flex items-center justify-between text-xs">
                              <span className="text-stone-400 truncate mr-2" title={r.referer}>{r.referer}</span>
                              <span className="text-stone-500 tabular-nums shrink-0">{r.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent scans */}
                    {slugStats.recentScans.length > 0 && (
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1.5">
                          Recent scans / 最近扫描记录
                        </p>
                        <div className="max-h-52 overflow-y-auto border border-stone-700 rounded-lg divide-y divide-stone-700">
                          {slugStats.recentScans.map((scan, i) => (
                            <div key={i} className="px-3 py-2 text-xs space-y-0.5">
                              <div className="flex justify-between">
                                <span className="text-stone-300">
                                  {new Date(scan.scannedAt).toLocaleString()}
                                </span>
                                {scan.country && (
                                  <span className="text-stone-500 uppercase text-[10px] font-medium">
                                    {scan.country}
                                  </span>
                                )}
                              </div>
                              {scan.ip && (
                                <div className="text-stone-500 truncate" title={scan.ip}>
                                  IP: {scan.ip}
                                </div>
                              )}
                              {scan.userAgent && (
                                <div className="text-stone-500 truncate" title={scan.userAgent}>
                                  {parseUA(scan.userAgent)}
                                </div>
                              )}
                              {scan.referer && (
                                <div className="text-stone-500 truncate" title={scan.referer}>
                                  Ref: {scan.referer}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-stone-400">Analytics unavailable. / 暂无统计数据。</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
