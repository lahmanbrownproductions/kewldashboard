"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import DOMPurify from "dompurify";

import { playErrorBeep, playSubmitBeep } from "@/lib/button-beep";
import type { NewsItem } from "@/lib/news-types";

const DEFAULT_RSS_URL = "https://joffreswait.substack.com/feed";
const STORAGE_KEY = "kewldashboard.newsRssFeeds.v1";
const MAX_FEEDS = 8;

type MainTab = "google" | "rss";

function normalizeInputUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return null;
    }
    if (u.protocol === "http:") {
      u.protocol = "https:";
    }
    return u.toString();
  } catch {
    return null;
  }
}

function feedLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || url.slice(0, 24);
  } catch {
    return url.slice(0, 28);
  }
}

type RssApiOk = { channelTitle: string; items: NewsItem[] };
type RssApiErr = { error: string };

type RssReaderState = { url: string; title: string; contentHtml?: string };

function readerIframeSrc(link: string): string | null {
  try {
    const u = new URL(link);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return null;
    }
    if (u.protocol === "http:") {
      u.protocol = "https:";
    }
    return u.toString();
  } catch {
    return null;
  }
}

export function NewsPanel({ initialGoogleNews }: { initialGoogleNews: NewsItem[] }) {
  const [mainTab, setMainTab] = useState<MainTab>("google");
  const [rssUrls, setRssUrls] = useState<string[]>([]);
  const [activeRssUrl, setActiveRssUrl] = useState<string | null>(null);
  const [rssItems, setRssItems] = useState<NewsItem[]>([]);
  const [channelTitle, setChannelTitle] = useState<string>("");
  const [rssLoading, setRssLoading] = useState(false);
  const [rssError, setRssError] = useState<string | null>(null);
  const [feedInput, setFeedInput] = useState("");
  const [rssReader, setRssReader] = useState<RssReaderState | null>(null);
  const [readerHost, setReaderHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setReaderHost(document.body);
  }, []);

  useEffect(() => {
    if (!rssReader) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRssReader(null);
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [rssReader]);

  useEffect(() => {
    setRssReader(null);
  }, [mainTab, activeRssUrl]);

  useEffect(() => {
    let parsed: string[] = [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw) as unknown;
        if (Array.isArray(data)) {
          for (const u of data) {
            if (typeof u !== "string") {
              continue;
            }
            const normalized = normalizeInputUrl(u);
            if (normalized) {
              parsed.push(normalized);
            }
          }
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    if (parsed.length === 0) {
      parsed = [DEFAULT_RSS_URL];
    }
    const deduped = [...new Set(parsed)].slice(0, MAX_FEEDS);
    setRssUrls(deduped);
    setActiveRssUrl(deduped[0] ?? null);
  }, []);

  useEffect(() => {
    if (rssUrls.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rssUrls));
  }, [rssUrls]);

  useEffect(() => {
    if (mainTab !== "rss" || !activeRssUrl) {
      return;
    }

    let cancelled = false;
    setRssLoading(true);
    setRssError(null);

    const q = encodeURIComponent(activeRssUrl);
    fetch(`/api/rss?url=${q}`)
      .then(async (res) => {
        const data = (await res.json()) as RssApiOk | RssApiErr;
        if (cancelled) {
          return;
        }
        if (!res.ok && "error" in data) {
          setRssError(data.error);
          setRssItems([]);
          setChannelTitle("");
          return;
        }
        if ("items" in data) {
          setRssItems(data.items);
          setChannelTitle(data.channelTitle);
          setRssError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRssError("Network error loading feed.");
          setRssItems([]);
          setChannelTitle("");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRssLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mainTab, activeRssUrl]);

  const addFeed = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const normalized = normalizeInputUrl(feedInput);
      if (!normalized) {
        playErrorBeep();
        setRssError("Enter a valid https feed URL.");
        return;
      }

      if (rssUrls.includes(normalized)) {
        playSubmitBeep();
        setActiveRssUrl(normalized);
        setFeedInput("");
        setRssError(null);
        return;
      }

      if (rssUrls.length >= MAX_FEEDS) {
        playErrorBeep();
        setRssError(`You can save at most ${MAX_FEEDS} feeds. Remove one first.`);
        return;
      }

      playSubmitBeep();
      setRssUrls([...rssUrls, normalized]);
      setActiveRssUrl(normalized);
      setFeedInput("");
      setRssError(null);
    },
    [feedInput, rssUrls],
  );

  const removeActiveFeed = useCallback(() => {
    if (!activeRssUrl) {
      return;
    }
    const idx = rssUrls.indexOf(activeRssUrl);
    const next = rssUrls.filter((u) => u !== activeRssUrl);
    setRssUrls(next);
    if (next.length === 0) {
      setActiveRssUrl(null);
    } else {
      setActiveRssUrl(next[Math.min(idx, next.length - 1)] ?? next[0] ?? null);
    }
  }, [activeRssUrl, rssUrls]);

  const headingDetail =
    mainTab === "google" ? "Google News" : rssLoading ? "Loading…" : channelTitle || "RSS";

  const displayItems = mainTab === "google" ? initialGoogleNews : rssItems;

  const listKeyPrefix = useMemo(() => (mainTab === "google" ? "g" : "r"), [mainTab]);

  const sanitizedReaderHtml = useMemo(() => {
    const raw = rssReader?.contentHtml?.trim();
    if (!raw) {
      return null;
    }
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    return clean.length > 0 ? clean : null;
  }, [rssReader]);

  const openRssArticle = useCallback((item: NewsItem) => {
    const src = readerIframeSrc(item.link);
    if (!src) {
      playErrorBeep();
      return;
    }
    setRssReader({
      url: src,
      title: item.title,
      contentHtml: item.contentHtml,
    });
  }, []);

  return (
    <section className="panel news-panel scroll-target" aria-label="Latest news" id="news">
      <div className="panel-heading">
        <span>Subspace Feed</span>
        <strong>{headingDetail}</strong>
      </div>

      <div className="market-panel-tabs news-panel-tabs" role="tablist" aria-label="News source">
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === "google"}
          className={mainTab === "google" ? "is-active" : ""}
          onClick={() => setMainTab("google")}
        >
          Google News
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === "rss"}
          className={mainTab === "rss" ? "is-active" : ""}
          onClick={() => setMainTab("rss")}
        >
          RSS
        </button>
      </div>

      {mainTab === "rss" ? (
        <div className="news-rss-controls">
          <div className="market-panel-tabs news-feed-tabs" role="tablist" aria-label="Saved RSS feeds">
            {rssUrls.map((url) => (
              <button
                key={url}
                type="button"
                role="tab"
                aria-selected={url === activeRssUrl}
                title={url}
                className={url === activeRssUrl ? "is-active" : ""}
                onClick={() => setActiveRssUrl(url)}
              >
                {feedLabel(url)}
              </button>
            ))}
          </div>
          <form className="watchlist-form news-rss-form" onSubmit={addFeed}>
            <input
              type="url"
              name="feedUrl"
              placeholder="https://example.substack.com/feed"
              autoComplete="off"
              value={feedInput}
              onChange={(ev) => setFeedInput(ev.target.value)}
            />
            <button type="submit">Add feed</button>
          </form>
          {rssUrls.length > 0 && activeRssUrl ? (
            <button type="button" className="news-rss-remove" onClick={removeActiveFeed}>
              Remove current feed
            </button>
          ) : null}
          {rssError ? <p className="news-rss-error">{rssError}</p> : null}
        </div>
      ) : null}

      <div className="news-list" aria-busy={mainTab === "rss" && rssLoading}>
        {mainTab === "rss" && rssLoading ? (
          <p className="news-rss-loading">Scanning subspace channels…</p>
        ) : mainTab === "rss" && !activeRssUrl ? (
          <p className="news-rss-loading">Add an RSS or Substack feed URL above.</p>
        ) : (
          displayItems.map((item) =>
            mainTab === "rss" ? (
              <button
                key={`${listKeyPrefix}-${item.link}-${item.title}`}
                type="button"
                className="news-list-card"
                onClick={() => openRssArticle(item)}
              >
                <span>{item.source}</span>
                <strong>{item.title}</strong>
              </button>
            ) : (
              <a
                key={`${listKeyPrefix}-${item.link}-${item.title}`}
                className="news-list-card"
                href={item.link}
                target="_blank"
                rel="noreferrer"
              >
                <span>{item.source}</span>
                <strong>{item.title}</strong>
              </a>
            ),
          )
        )}
      </div>

      {readerHost && rssReader
        ? createPortal(
            <div
              className="news-reader-backdrop"
              onClick={() => setRssReader(null)}
              role="presentation"
            >
              <div
                className="news-reader-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="news-reader-title"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="news-reader-toolbar">
                  <h2 id="news-reader-title">{rssReader.title}</h2>
                  <div className="news-reader-actions">
                    <button type="button" className="news-reader-close" onClick={() => setRssReader(null)}>
                      Close
                    </button>
                    <a
                      className="news-reader-external"
                      href={rssReader.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in tab
                    </a>
                  </div>
                </header>
                {sanitizedReaderHtml ? (
                  <div className="news-reader-prose-scroll">
                    <article
                      className="news-reader-prose"
                      dangerouslySetInnerHTML={{ __html: sanitizedReaderHtml }}
                    />
                  </div>
                ) : (
                  <>
                    <p className="news-reader-note">
                      No full article HTML in this feed; showing the live page. Use Open in tab if the frame is blank.
                    </p>
                    <iframe
                      key={rssReader.url}
                      className="news-reader-frame"
                      src={rssReader.url}
                      title={rssReader.title}
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </>
                )}
              </div>
            </div>,
            readerHost,
          )
        : null}
    </section>
  );
}
