import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

const lastHashes = new Map<string, string>();

function contentHash(text: string): string {
  const normalized = text.split("\n").map((l) => l.trimEnd()).join("\n").trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function absUrl(base: string, maybeRel: string | undefined | null): string | null {
  if (!maybeRel) return null;
  try { return new URL(maybeRel, base).href; } catch { return null; }
}

function htmlToMarkdown($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>): string {
  const parts: string[] = [];
  root.find("h1, h2, h3, h4, p, li, blockquote").each((_, el) => {
    const tag = (el as any).tagName?.toLowerCase() || "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text || text.length < 2) return;
    if (tag === "h1") parts.push(`# ${text}`);
    else if (tag === "h2") parts.push(`## ${text}`);
    else if (tag === "h3" || tag === "h4") parts.push(`### ${text}`);
    else if (tag === "li") parts.push(`- ${text}`);
    else if (tag === "blockquote") parts.push(`> ${text}`);
    else parts.push(text);
  });
  if (parts.length < 3) {
    const body = root.text().replace(/\s+/g, " ").trim();
    if (body) {
      const chunks = body.match(/.{1,280}(\s|$)/g) || [body];
      return chunks.map((c) => c.trim()).filter(Boolean).join("\n\n");
    }
  }
  const out: string[] = [];
  for (const p of parts) {
    if (out[out.length - 1] === p) continue;
    out.push(p);
  }
  return out.join("\n\n").slice(0, 12000);
}

function extractPage(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg, nav, footer, header").remove();
  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() || "";
  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() || "";
  const thumbnail =
    absUrl(pageUrl, $('meta[property="og:image"]').attr("content")) ||
    absUrl(pageUrl, $('meta[name="twitter:image"]').attr("content")) ||
    absUrl(pageUrl, $('meta[property="twitter:image"]').attr("content")) || null;
  let favicon =
    absUrl(pageUrl, $('link[rel="apple-touch-icon"]').attr("href")) ||
    absUrl(pageUrl, $('link[rel="icon"]').attr("href")) ||
    absUrl(pageUrl, $('link[rel="shortcut icon"]').attr("href")) || null;
  if (!favicon) {
    try { favicon = `${new URL(pageUrl).origin}/favicon.ico`; } catch { /* ignore */ }
  }
  const mainEl =
    $("main").first().length > 0 ? $("main").first()
    : $("article").first().length > 0 ? $("article").first()
    : $("[role=main]").first().length > 0 ? $("[role=main]").first()
    : $("body");
  const markdown = htmlToMarkdown($, mainEl);
  return { title, description, thumbnail, favicon, markdown };
}

async function fetchPage(url: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NewsMonitorDemo/2.0; +https://news-monitor-demo.vercel.app)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}` };
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("xml"))
      return { ok: false as const, error: `Not HTML (${contentType})` };
    const html = await res.text();
    const extracted = extractPage(html, url);
    if (!extracted.markdown || extracted.markdown.length < 40)
      return { ok: false as const, error: "Too little extractable text" };
    return { ok: true as const, ...extracted };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "Timeout" : e?.message || "Fetch failed";
    return { ok: false as const, error: msg };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const urls: string[] = Array.isArray(body?.urls) ? body.urls : [];
    if (urls.length === 0)
      return NextResponse.json({ error: "No URLs provided" }, { status: 400 });
    if (urls.length > 5)
      return NextResponse.json({ error: "Max 5 URLs per request" }, { status: 400 });

    const results = [];
    const checkedAt = new Date().toISOString();

    for (const raw of urls) {
      let url = String(raw).trim();
      if (!url) continue;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      try { new URL(url); } catch {
        results.push({ url, status: "error", error: "Invalid URL", checkedAt });
        continue;
      }
      const page = await fetchPage(url);
      if (!page.ok) {
        results.push({ url, status: "error", error: page.error || "Failed", checkedAt });
        continue;
      }
      const hash = contentHash(page.markdown);
      const prev = lastHashes.get(url) ?? null;
      let status: "new" | "changed" | "same" = "same";
      if (prev === null) status = "new";
      else if (prev !== hash) status = "changed";
      lastHashes.set(url, hash);
      results.push({
        url, status, hash, previousHash: prev,
        title: page.title, description: page.description,
        length: page.markdown.length,
        markdown: page.markdown.slice(0, 6000),
        thumbnail: page.thumbnail, favicon: page.favicon, checkedAt,
      });
    }
    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
