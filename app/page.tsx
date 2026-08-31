"use client";
import { useMemo, useState } from "react";

type Lang = "en" | "hi";
type CheckResult = {
  url: string; status: "new" | "changed" | "same" | "error";
  hash?: string; previousHash?: string | null; title?: string;
  description?: string; length?: number; markdown?: string;
  thumbnail?: string | null; favicon?: string | null; error?: string; checkedAt: string;
};

const COPY = {
  en: {
    title: "News / Trend Monitor",
    subtitle: "Advanced change detection: fetch → Markdown → SHA-256. Stores only changes. Inspired by Crawl4AI.",
    urlsLabel: "URLs to monitor (one per line, max 5)",
    check: "Check for changes", checking: "Checking…", reset: "Reset demo URLs",
    limit: "Demo limit: max 5 URLs per request.", needUrl: "Add at least one URL.",
    checked: (n: number) => `Checked ${n} URL(s). Run again to detect changes.`,
    noteTitle: "Demo limits (Vercel serverless)",
    noteBody: "HTTP fetch + HTML→Markdown (no Playwright). Thumbnails from Open Graph tags. Full local tool uses Crawl4AI sessions, CacheMode.BYPASS, retries, SQLite.",
    localCmd: "python monitor.py --urls-file urls.txt --once",
    footer: "Change-monitor concept · in-memory hashes",
    status: { new: "New", changed: "Changed", same: "Same", error: "Error" },
    chars: "chars", hash: "hash", was: "was", noPreview: "No content preview",
    statsTotal: "Total", statsNew: "New", statsChanged: "Changed", statsSame: "Same", statsError: "Errors",
  },
  hi: {
    title: "समाचार / ट्रेंड मॉनिटर",
    subtitle: "उन्नत परिवर्तन पहचान: पेज → मार्कडाउन → SHA-256 हैश। केवल बदलाव सहेजता है। Crawl4AI से प्रेरित।",
    urlsLabel: "मॉनिटर करने वाले URL (एक पंक्ति में एक, अधिकतम 5)",
    check: "बदलाव जाँचें", checking: "जाँच हो रही है…", reset: "डेमो URL रीसेट",
    limit: "डेमो सीमा: अधिकतम 5 URL।", needUrl: "कम से कम एक URL डालें।",
    checked: (n: number) => `${n} URL जाँचे गए। बदलाव देखने के लिए दोबारा चलाएँ।`,
    noteTitle: "डेमो सीमाएँ (Vercel serverless)",
    noteBody: "HTTP fetch + HTML→मार्कडाउन। थंबनेल Open Graph से। पूरा लोकल टूल Crawl4AI, सेशन, CacheMode.BYPASS, SQLite उपयोग करता है।",
    localCmd: "python monitor.py --urls-file urls.txt --once",
    footer: "परिवर्तन-मॉनिटर · इन-मेमोरी हैश",
    status: { new: "नया", changed: "बदला", same: "समान", error: "त्रुटि" },
    chars: "अक्षर", hash: "हैश", was: "पहले", noPreview: "पूर्वावलोकन उपलब्ध नहीं",
    statsTotal: "कुल", statsNew: "नए", statsChanged: "बदले", statsSame: "समान", statsError: "त्रुटियाँ",
  },
} as const;

const DEFAULT_URLS = `https://news.ycombinator.com
https://example.com
https://www.bbc.com/news`;

function mdToHtml(md: string): string {
  if (!md) return "";
  let s = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/```[\s\S]*?```/g, (b) => `<pre><code>${b.replace(/^```\w*\n?/, "").replace(/```$/, "")}</code></pre>`);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>");
  s = s.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  return s.split(/\n{2,}/).map((p) => /^<(h[123]|ul|pre|li)/.test(p.trim()) ? p : `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("");
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const t = COPY[lang];
  const [urlsText, setUrlsText] = useState(DEFAULT_URLS);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const stats = useMemo(() => {
    const s = { total: results.length, new: 0, changed: 0, same: 0, error: 0 };
    for (const r of results) {
      if (r.status === "new") s.new++;
      else if (r.status === "changed") s.changed++;
      else if (r.status === "same") s.same++;
      else s.error++;
    }
    return s;
  }, [results]);

  async function runCheck() {
    const urls = urlsText.split("\n").map((u) => u.trim()).filter((u) => u && !u.startsWith("#"));
    if (!urls.length) { setMessage(t.needUrl); return; }
    if (urls.length > 5) { setMessage(t.limit); return; }
    setLoading(true); setMessage(null); setResults([]);
    try {
      const res = await fetch("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls }) });
      const data = await res.json();
      if (!res.ok) setMessage(data.error || "Request failed");
      else { setResults(data.results || []); setMessage(t.checked(data.results?.length ?? 0)); }
    } catch (e: any) { setMessage(e?.message || "Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <div className="lang-toggle" role="group" aria-label="Language">
          <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
          <button type="button" className={lang === "hi" ? "active" : ""} onClick={() => setLang("hi")}>हिंदी</button>
        </div>
      </header>

      <div className="card">
        <label htmlFor="urls">{t.urlsLabel}</label>
        <textarea id="urls" rows={5} value={urlsText} onChange={(e) => setUrlsText(e.target.value)} dir="auto" />
        <div className="row">
          <button className="primary" onClick={runCheck} disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? t.checking : t.check}
          </button>
          <button className="secondary" type="button" disabled={loading} onClick={() => { setUrlsText(DEFAULT_URLS); setResults([]); setMessage(null); }}>
            {t.reset}
          </button>
        </div>
      </div>

      {message && <p className="msg">{message}</p>}

      {results.length > 0 && (
        <div className="stats-bar">
          <div className="stat"><strong>{stats.total}</strong> <span>{t.statsTotal}</span></div>
          <div className="stat"><strong style={{ color: "var(--accent2)" }}>{stats.new}</strong> <span>{t.statsNew}</span></div>
          <div className="stat"><strong style={{ color: "var(--success)" }}>{stats.changed}</strong> <span>{t.statsChanged}</span></div>
          <div className="stat"><strong>{stats.same}</strong> <span>{t.statsSame}</span></div>
          <div className="stat"><strong style={{ color: "var(--danger)" }}>{stats.error}</strong> <span>{t.statsError}</span></div>
        </div>
      )}

      {results.map((r) => (
        <div className="card" key={r.url + r.checkedAt}>
          <div className="result-card">
            <div className="thumb-wrap">
              {r.thumbnail ? (
                <img src={r.thumbnail} alt="" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : r.favicon ? (
                <img src={r.favicon} alt="" width={32} height={32} style={{ objectFit: "contain" }} referrerPolicy="no-referrer" />
              ) : (
                <span className="thumb-fallback">📰</span>
              )}
            </div>
            <div className="result-body">
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                <span className={`badge ${r.status}`}>{t.status[r.status]}</span>
                <h3 style={{ margin: 0 }}>{r.title || r.url}</h3>
              </div>
              {r.title && <div className="meta"><span style={{ wordBreak: "break-all", opacity: 0.85 }}>{r.url}</span></div>}
              <div className="meta">
                {r.length != null && <span>{r.length.toLocaleString()} {t.chars}</span>}
                {r.hash && <span>{t.hash} {r.hash.slice(0, 12)}…</span>}
                {r.previousHash && <span>{t.was} {r.previousHash.slice(0, 8)}…</span>}
                <span>{new Date(r.checkedAt).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN")}</span>
              </div>
              {r.description && <p style={{ margin: "0 0 0.6rem", fontSize: "0.88rem", color: "var(--muted)" }}>{r.description}</p>}
              {r.error && <p style={{ color: "var(--danger)", margin: "0.35rem 0" }}>{r.error}</p>}
              {r.markdown ? (
                <div className="md-preview" dangerouslySetInnerHTML={{ __html: mdToHtml(r.markdown) }} />
              ) : !r.error && <div className="md-preview" style={{ opacity: 0.6 }}>{t.noPreview}</div>}
            </div>
          </div>
        </div>
      ))}

      <div className="note">
        <strong>{t.noteTitle}</strong><br />{t.noteBody}<br /><br /><code>{t.localCmd}</code>
      </div>
      <footer>{t.footer}</footer>
    </div>
  );
}
