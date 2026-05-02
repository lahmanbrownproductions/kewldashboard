import type { NewsItem } from "@/lib/news-types";
import { parseRssXml } from "@/lib/rss";

export type { NewsItem };

const FALLBACK_NEWS: NewsItem[] = [
  {
    title: "Unable to hail Google News. Auxiliary feed standing by.",
    link: "https://news.google.com/",
    source: "Google News",
  },
  {
    title: "Weather, route, and market panels remain online.",
    link: "https://news.google.com/",
    source: "Dashboard",
  },
];

export async function getNewsItems(): Promise<NewsItem[]> {
  try {
    const response = await fetch("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", {
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      return FALLBACK_NEWS;
    }

    const xml = await response.text();
    const { items } = parseRssXml(xml, 6, "Google News");

    const withSources = items.map((row) => ({
      ...row,
      source: row.source || "Google News",
    }));

    return withSources.length > 0 ? withSources : FALLBACK_NEWS;
  } catch {
    return FALLBACK_NEWS;
  }
}
