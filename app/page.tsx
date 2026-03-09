"use client";

import { useCallback, useEffect, useState } from "react";

type Session = { authenticated: boolean };
type Settings = { redirects: Record<string, string>; canEdit: boolean };

function fullRedirectUrl(slug: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "";
  return base + "/go/" + encodeURIComponent(slug);
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [code, setCode] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        redirects: data.redirects ?? {},
        canEdit: data.canEdit === true,
      });
    } catch {
      setError("Failed to load settings");
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
        setError(data.error ?? "Login failed");
        return;
      }
      setCode("");
      await fetchSession();
    } catch {
      setError("Request failed");
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
        body: JSON.stringify({ slug: newSlug.trim(), targetUrl: newUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setMessage("Link added.");
      setNewSlug("");
      setNewUrl("");
      await fetchSettings();
    } catch {
      setError("Request failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!settings?.canEdit) return;
    if (!confirm("Delete this link?")) return;
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Delete failed");
        return;
      }
      await fetchSettings();
    } catch {
      setError("Request failed");
    }
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
      setError("Download failed");
    }
  };

  /* --- Loading --- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  /* --- Login --- */
  if (!session?.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h1>
          <p className="text-sm text-gray-500 mb-5">
            Enter the 6-digit code from your authenticator app.
          </p>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin}>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Code
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base tracking-widest
                         focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent mb-4"
            />
            <button
              type="submit"
              disabled={saving || code.length !== 6}
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white
                         hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Verifying..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* --- Dashboard --- */
  const entries = settings ? Object.entries(settings.redirects) : [];
  const canEdit = settings?.canEdit === true;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">QR Redirect</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {/* Add link form */}
        {canEdit && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Add or update link</h2>
            <p className="text-xs text-gray-500 mb-4">
              Use an existing slug to change its redirect URL.
            </p>
            <form onSubmit={handleAddLink} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 min-w-0">
                <label htmlFor="newSlug" className="block text-xs font-medium text-gray-600 mb-1">
                  Slug
                </label>
                <input
                  id="newSlug"
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                  placeholder="e.g. ig"
                  maxLength={64}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div className="flex-[2] min-w-0">
                <label htmlFor="newUrl" className="block text-xs font-medium text-gray-600 mb-1">
                  Redirect URL
                </label>
                <input
                  id="newUrl"
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving || !newSlug.trim() || !newUrl.trim()}
                  className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white whitespace-nowrap
                             hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        )}

        {!canEdit && (
          <div className="rounded-lg bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-800">
            Add Supabase to create or edit links from the UI. Until then, a single link from{" "}
            <code className="bg-sky-100 px-1 rounded text-xs">REDIRECT_TARGET_URL</code> is shown
            as &quot;default&quot;.
          </div>
        )}

        {/* Links table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Links</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Each link has a short path. Scan the QR or open the full URL to redirect.
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No links yet.{canEdit ? " Add one above." : " Connect Supabase to get started."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3">Slug</th>
                    <th className="px-5 py-3">Full URL</th>
                    <th className="px-5 py-3">Redirects to</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map(([slug, url]) => (
                    <tr key={slug} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {slug}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <a
                          href={fullRedirectUrl(slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {fullRedirectUrl(slug)}
                        </a>
                      </td>
                      <td className="px-5 py-3 max-w-xs truncate text-gray-500">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-gray-700 hover:underline"
                          title={url}
                        >
                          {url}
                        </a>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <a
                            href={"/go/" + encodeURIComponent(slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700
                                       hover:bg-gray-200 transition-colors no-underline"
                          >
                            Open
                          </a>
                          <button
                            type="button"
                            onClick={() => downloadQr(slug)}
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700
                                       hover:bg-gray-200 transition-colors"
                          >
                            QR
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDelete(slug)}
                              className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600
                                         hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
