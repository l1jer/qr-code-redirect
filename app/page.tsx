"use client";

import { useCallback, useEffect, useState } from "react";

type Session = { authenticated: boolean };
type Settings = { redirects: Record<string, string>; canEdit: boolean };

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

  if (loading) {
    return (
      <div className="container">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session?.authenticated) {
    return (
      <div className="container">
        <h1>Sign in</h1>
        <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1rem" }}>
          Enter the 6-digit code from your authenticator app.
        </p>
        {error && (
          <div className="alert alertError">{error}</div>
        )}
        <form onSubmit={handleLogin}>
          <div className="formGroup">
            <label htmlFor="code">Code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
            />
          </div>
          <button type="submit" className="btn" disabled={saving || code.length !== 6}>
            {saving ? "Verifying..." : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  const entries = settings ? Object.entries(settings.redirects) : [];
  const canEdit = settings?.canEdit === true;

  return (
    <div className="container">
      <h1>QR Redirect</h1>
      {error && <div className="alert alertError">{error}</div>}
      {message && <div className="alert alertInfo">{message}</div>}

      {canEdit && (
        <form onSubmit={handleAddLink} style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.75rem" }}>Add or update link</h2>
          <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.5rem" }}>Use an existing slug to change its URL.</p>
          <div className="formGroup">
            <label htmlFor="newSlug">Short name (slug)</label>
            <input
              id="newSlug"
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              placeholder="e.g. ig or shop"
              maxLength={64}
            />
          </div>
          <div className="formGroup">
            <label htmlFor="newUrl">Redirect URL</label>
            <input
              id="newUrl"
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <button type="submit" className="btn" disabled={saving || !newSlug.trim() || !newUrl.trim()}>
            {saving ? "Adding..." : "Add link"}
          </button>
        </form>
      )}

      {!canEdit && (
        <p className="alert alertInfo" style={{ marginBottom: "1rem" }}>
          Add Supabase (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) to create or edit links. Until then, a single link from <code>REDIRECT_TARGET_URL</code> is shown as &quot;default&quot;.
        </p>
      )}

      <div className="qrWrap">
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Links</h2>
        <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.75rem" }}>
          Each link has a short path <strong>/go/[slug]</strong>. Scan the QR or open the link to redirect.
        </p>
        {entries.length === 0 ? (
          <p style={{ color: "#666" }}>No links yet. Add one above (requires Supabase).</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {entries.map(([slug, url]) => (
              <li
                key={slug}
                style={{
                  padding: "0.75rem 0",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontWeight: 500, minWidth: "5rem" }}>/go/{slug}</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "0.875rem", color: "#666", flex: "1 1 200px", wordBreak: "break-all" }}
                >
                  {url}
                </a>
                <span className="actions">
                  <a href={"/go/" + encodeURIComponent(slug)} target="_blank" rel="noopener noreferrer" className="btn btnSecondary" style={{ textDecoration: "none" }}>
                    Open
                  </a>
                  <button type="button" className="btn btnSecondary" onClick={() => downloadQr(slug)}>
                    QR
                  </button>
                  {canEdit && (
                    <button type="button" className="btn" style={{ background: "#b91c1c" }} onClick={() => handleDelete(slug)}>
                      Delete
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="logout">
        <button type="button" className="btn btnSecondary" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
