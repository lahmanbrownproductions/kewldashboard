import { NextResponse } from "next/server";

import type { NewsItem } from "@/lib/news-types";
import { parseRssXml } from "@/lib/rss";

const URL_MAX = 2048;
const MAX_ITEMS = 12;

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".local")) {
    return true;
  }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    return false;
  }
  const parts = h.split(".").map((p) => Number(p));
  const [a, b] = parts;
  if (a === undefined || b === undefined) {
    return false;
  }
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  return false;
}

function normalizeFeedUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > URL_MAX) {
    return null;
  }

  let candidate = trimmed;
  if (/^http:\/\//i.test(candidate)) {
    candidate = `https://${candidate.slice(7)}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") {
    return null;
  }

  const host = parsed.hostname;
  if (!host || isBlockedHost(host)) {
    return null;
  }

  return parsed.toString();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedUrl = normalizeFeedUrl(searchParams.get("url") ?? "");

  if (!feedUrl) {
    return NextResponse.json({ error: "Invalid or disallowed feed URL." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(feedUrl, {
      headers: { "User-Agent": "kewldashboard/1.0 (+https://kewldashboard) rss-proxy" },
      next: { revalidate: 300 },
    });
  } catch {
    return NextResponse.json({ error: "Could not fetch feed." }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: `Feed returned HTTP ${response.status}.` }, { status: 502 });
  }

  const xml = await response.text();
  const { channelTitle, items } = parseRssXml(xml, MAX_ITEMS, "RSS", { includeItemHtml: true });

  if (items.length === 0) {
    return NextResponse.json(
      { error: "No stories found. Paste the RSS feed link (often ends in /feed)." },
      { status: 422 },
    );
  }

  const body: { channelTitle: string; items: NewsItem[] } = { channelTitle, items };
  return NextResponse.json(body);
}
