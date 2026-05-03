"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";

import { playErrorBeep, playReaderCloseBeep, playRefreshBeep, playSubmitBeep } from "@/lib/button-beep";
import type { NewsItem } from "@/lib/news-types";

const DEFAULT_RSS_URL = "https://joffreswait.substack.com/feed";
const STORAGE_KEY = "kewldashboard.newsRssFeeds.v1";
const MAX_FEEDS = 8;
/** Poll active feed while the dashboard is open; gentler than stock ticks. */
const RSS_REFRESH_MS = 180_000;

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

/** HTML that survives sanitization — required for in-app reader (no iframe). */
function sanitizableArticleHtml(item: NewsItem): string | null {
  const raw = item.contentHtml?.trim();
  if (!raw) {
    return null;
  }
  const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  return clean.length > 0 ? clean : null;
}

function canonicalArticleUrl(link: string): string | null {
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

type RssApiOk = { channelTitle: string; items: NewsItem[] };
type RssApiErr = { error: string };

type ArticleReaderState = { canonicalUrl: string; title: string; contentHtml: string };

export function NewsPanel() {
  const [rssUrls, setRssUrls] = useState<string[]>([]);
  const [activeRssUrl, setActiveRssUrl] = useState<string | null>(null);
  const [rssItems, setRssItems] = useState<NewsItem[]>([]);
  const [channelTitle, setChannelTitle] = useState<string>("");
  const [rssLoading, setRssLoading] = useState(false);
  const [rssError, setRssError] = useState<string | null>(null);
  const [feedInput, setFeedInput] = useState("");
  const [articleReader, setArticleReader] = useState<ArticleReaderState | null>(null);
  const proseScrollRef = useRef<HTMLDivElement>(null);
  const rssFetchGenRef = useRef(0);

  const fetchActiveRss = useCallback(
    async (kind: "initial" | "silent" | "manual") => {
      const url = activeRssUrl;
      if (!url) {
        return;
      }

      if (kind === "silent" && document.visibilityState !== "visible") {
        return;
      }

      const silent = kind === "silent";
      const showSpinner = !silent;

      const myGen = ++rssFetchGenRef.current;
      const rssApiUrl = `/api/rss?url=${encodeURIComponent(url)}`;

      if (showSpinner) {
        setRssLoading(true);
        setRssError(null);
      }

      try {
        const res = await fetch(rssApiUrl);
        const data = (await res.json()) as RssApiOk | RssApiErr;
        if (myGen !== rssFetchGenRef.current) {
          return;
        }
        if (!res.ok && "error" in data) {
          if (!silent) {
            setRssError(data.error);
            setRssItems([]);
            setChannelTitle("");
          }
          return;
        }
        if ("items" in data) {
          setRssItems(data.items);
          setChannelTitle(data.channelTitle);
          setRssError(null);
        }
      } catch {
        if (myGen !== rssFetchGenRef.current) {
          return;
        }
        if (!silent) {
          setRssError("Network error loading feed.");
          setRssItems([]);
          setChannelTitle("");
        }
      } finally {
        if (myGen !== rssFetchGenRef.current) {
          return;
        }
        if (showSpinner) {
          setRssLoading(false);
        }
      }
    },
    [activeRssUrl],
  );

  const refreshRssManual = useCallback(() => {
    playRefreshBeep();
    void fetchActiveRss("manual");
  }, [fetchActiveRss]);

  const readerCanonicalUrl = articleReader?.canonicalUrl ?? "";
  const readerTitle = articleReader?.title ?? "";

  useLayoutEffect(() => {
    if (!readerCanonicalUrl) {
      return;
    }
    proseScrollRef.current?.scrollTo(0, 0);
    document.getElementById("news")?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [readerCanonicalUrl, readerTitle]);

  useEffect(() => {
    if (!readerCanonicalUrl) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setArticleReader(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [readerCanonicalUrl, readerTitle]);

  useEffect(() => {
    setArticleReader(null);
  }, [activeRssUrl]);

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
    if (!activeRssUrl) {
      return;
    }

    void fetchActiveRss("initial");

    const interval = window.setInterval(() => {
      void fetchActiveRss("silent");
    }, RSS_REFRESH_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void fetchActiveRss("silent");
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      rssFetchGenRef.current += 1;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeRssUrl, fetchActiveRss]);

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

  const headingDetail = rssLoading ? "Loading…" : channelTitle || "RSS";

  const renderableItems = useMemo(
    () => rssItems.filter((item) => sanitizableArticleHtml(item) !== null),
    [rssItems],
  );

  const sanitizedReaderHtml = useMemo(() => {
    const raw = articleReader?.contentHtml?.trim();
    if (!raw) {
      return null;
    }
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    return clean.length > 0 ? clean : null;
  }, [articleReader]);

  const openArticle = useCallback((item: NewsItem) => {
    const html = item.contentHtml?.trim();
    const canonicalUrl = canonicalArticleUrl(item.link);
    if (!html || !sanitizableArticleHtml(item) || !canonicalUrl) {
      playErrorBeep();
      return;
    }
    setArticleReader({
      canonicalUrl,
      title: item.title,
      contentHtml: html,
    });
  }, []);

  const closeArticle = useCallback(() => {
    setArticleReader(null);
  }, []);

  const feedCrumbLabel =
    activeRssUrl && channelTitle ? channelTitle : activeRssUrl ? feedLabel(activeRssUrl) : "Feed";

  return (
    <section className="panel news-panel scroll-target" aria-label="RSS news" id="news">
      <div className="panel-heading news-panel-heading">
        <span>Subspace Feed</span>
        <div className="news-panel-heading__title-row">
          <strong>{articleReader ? feedCrumbLabel : headingDetail}</strong>
          {activeRssUrl ? (
            <button
              type="button"
              className={`news-rss-refresh${rssLoading ? " news-rss-refresh--loading" : ""}`}
              onClick={refreshRssManual}
              disabled={rssLoading}
              title="Refresh feed"
              aria-label="Refresh RSS feed"
            >
              <svg className="news-rss-refresh__icon" viewBox="0 0 24 24" width={18} height={18} aria-hidden>
                <path
                  fill="currentColor"
                  d="M17.65 6.35A7.958 7.958 0 0012 4V1L7 6l5 5V7c2.76 0 5 2.24 5 5 0 1.13-.38 2.16-1 2.97l1.46 1.46A7.93 7.93 0 0020 12c0-2.21-.9-4.22-2.35-5.65zM12 19c-2.76 0-5-2.24-5-5 0-1.13.38-2.16 1-2.97L6.54 9.57A7.93 7.93 0 004 12c0 2.21.9 4.22 2.35 5.65A7.958 7.958 0 0012 20v3l5-5-5-5v3z"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="news-panel-main">
        {articleReader ? (
          <>
            <nav className="news-feed-breadcrumb" aria-label="Feed navigation">
              <button type="button" className="news-feed-breadcrumb__crumb" onClick={closeArticle}>
                Subspace Feed
              </button>
              <span className="news-feed-breadcrumb__sep" aria-hidden>
                ›
              </span>
              <button type="button" className="news-feed-breadcrumb__crumb" onClick={closeArticle}>
                {feedCrumbLabel}
              </button>
              <span className="news-feed-breadcrumb__sep" aria-hidden>
                ›
              </span>
              <span className="news-feed-breadcrumb__current" title={articleReader.title} aria-current="page">
                {articleReader.title}
              </span>
            </nav>

            <div className="news-reader-inline">
              <header className="news-reader-toolbar">
                <h2 id="news-reader-title" className="news-reader-title-inline">
                  {articleReader.title}
                </h2>
                <div className="news-reader-actions">
                  <button
                    type="button"
                    className="news-reader-close-x"
                    onClick={() => {
                      playReaderCloseBeep();
                      closeArticle();
                    }}
                    title="Close and return to feed"
                    aria-label="Close article and return to feed list"
                  >
                    ×
                  </button>
                  <a
                    className="news-reader-external"
                    href={articleReader.canonicalUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open RSS source
                  </a>
                </div>
              </header>
              {sanitizedReaderHtml ? (
                <div
                  ref={proseScrollRef}
                  className="news-reader-prose-scroll news-reader-prose-scroll--inline"
                >
                  <article
                    className="news-reader-prose"
                    dangerouslySetInnerHTML={{ __html: sanitizedReaderHtml }}
                  />
                </div>
              ) : (
                <p className="news-reader-note">
                  This story could not be sanitized for in-app display. Open the RSS source.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
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
                  placeholder="Full-text feed URL (e.g. Substack …/feed)"
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
              <p className="news-rss-hint">
                Only stories with HTML in the feed are listed—headline-only feeds (many news wires) stay hidden unless you
                swap the source.
              </p>
              {rssError ? <p className="news-rss-error">{rssError}</p> : null}
            </div>

            <div className="news-list" aria-busy={rssLoading}>
              {rssLoading ? (
                <p className="news-rss-loading">Scanning subspace channels…</p>
              ) : !activeRssUrl ? (
                <p className="news-rss-loading">Add a full-text RSS feed URL above.</p>
              ) : renderableItems.length === 0 ? (
                <p className="news-rss-loading">
                  Nothing in this feed includes article markup. Try Substack, WordPress <code>/feed/</code>, or another
                  source that publishes <code>content:encoded</code> or full HTML descriptions—not headline-only RSS.
                </p>
              ) : (
                renderableItems.map((item) => (
                  <button
                    key={`r-${item.link}-${item.title}`}
                    type="button"
                    className="news-list-card"
                    onClick={() => openArticle(item)}
                  >
                    <span>{item.source}</span>
                    <strong>{item.title}</strong>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
