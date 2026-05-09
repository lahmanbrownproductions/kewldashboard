import type { NewsItem } from "@/lib/news-types";

const decodeEntities = (value: string) =>
  value
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replaceAll("&amp;", "&");

const stripCdata = (value: string) => value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");

export function readXmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(decodeEntities(stripCdata(match[1].trim()))) : "";
}

function channelSection(xml: string): string {
  const m = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i);
  return m?.[1] ?? xml;
}

function channelTitleFromXml(xml: string): string {
  const ch = channelSection(xml);
  const beforeItems = ch.split(/<item[\s>]/i)[0] ?? ch;
  return readXmlTag(beforeItems, "title");
}

function itemSource(item: string, fallback: string): string {
  return (
    readXmlTag(item, "source") ||
    readXmlTag(item, "dc:creator") ||
    readXmlTag(item, "author") ||
    fallback
  );
}

const MAX_ITEM_HTML_CHARS = 450_000;

function truncateItemHtml(raw: string): string {
  if (raw.length <= MAX_ITEM_HTML_CHARS) {
    return raw;
  }
  return `${raw.slice(0, MAX_ITEM_HTML_CHARS)}<p>…</p>`;
}

function stripTagsToPlain(html: string): string {
  return decodeEntities(stripCdata(html))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncatePlain(plain: string, maxLen: number): string {
  if (plain.length <= maxLen) {
    return plain;
  }
  const slice = plain.slice(0, maxLen);
  const cut = slice.replace(/\s+\S*$/, "");
  return `${cut.length > 0 ? cut : slice}…`;
}

function excerptFromHtmlChunk(html: string, maxLen: number): string {
  const slice = html.length > 12_000 ? html.slice(0, 12_000) : html;
  return truncatePlain(stripTagsToPlain(slice), maxLen);
}

function itemBodyHtml(itemXml: string, include: boolean): string | undefined {
  if (!include) {
    return undefined;
  }
  const encoded = readXmlTag(itemXml, "content:encoded");
  if (encoded) {
    return truncateItemHtml(encoded);
  }
  const description = readXmlTag(itemXml, "description");
  if (description) {
    return truncateItemHtml(description);
  }
  return undefined;
}

export type ParsedRss = {
  channelTitle: string;
  items: NewsItem[];
};

export type ParseRssOptions = {
  /** When true, include `contentHtml` from `content:encoded` / `description`. Omit for large / public aggregators. */
  includeItemHtml?: boolean;
};

export function parseRssXml(
  xml: string,
  itemLimit: number,
  fallbackSource = "RSS",
  options?: ParseRssOptions,
): ParsedRss {
  const includeHtml = options?.includeItemHtml === true;
  const channelTitle = channelTitleFromXml(xml) || fallbackSource;
  const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)]
    .slice(0, itemLimit)
    .map((match) => {
      const itemInner = match[1];
      const title = readXmlTag(itemInner, "title");
      const link = readXmlTag(itemInner, "link");
      const source = itemSource(itemInner, channelTitle);
      const descriptionRaw = readXmlTag(itemInner, "description");
      const contentHtml = itemBodyHtml(itemInner, includeHtml);

      if (!title || !link) {
        return null;
      }

      const row: NewsItem = { title, link, source };
      if (contentHtml) {
        row.contentHtml = contentHtml;
      }

      let excerpt: string | undefined;
      if (descriptionRaw) {
        const p = truncatePlain(stripTagsToPlain(descriptionRaw), 300);
        if (p.length > 0) {
          excerpt = p;
        }
      }
      if (!excerpt && contentHtml) {
        excerpt = excerptFromHtmlChunk(contentHtml, 300);
      }
      if (excerpt) {
        row.excerpt = excerpt;
      }

      return row;
    })
    .filter((item): item is NewsItem => item !== null);

  return { channelTitle, items };
}
