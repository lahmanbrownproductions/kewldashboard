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

  const headingDetail = rssLoading ? "Loading…" : channelTitle || "Relay";

  const displayItems = useMemo(
    () =>
      rssItems.filter(
        (item) => Boolean(item.excerpt?.trim()) || sanitizableArticleHtml(item) !== null,
      ),
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

  const handleReadMore = useCallback((item: NewsItem) => {
    if (sanitizableArticleHtml(item)) {
      const html = item.contentHtml?.trim();
      const canonicalUrl = canonicalArticleUrl(item.link);
      if (!html || !canonicalUrl) {
        playErrorBeep();
        return;
      }
      setArticleReader({
        canonicalUrl,
        title: item.title,
        contentHtml: html,
      });
      return;
    }
    const url = canonicalArticleUrl(item.link);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      playErrorBeep();
    }
  }, []);

  const closeArticle = useCallback(() => {
    setArticleReader(null);
  }, []);

  const feedCrumbLabel =
    activeRssUrl && channelTitle ? channelTitle : activeRssUrl ? feedLabel(activeRssUrl) : "Channel";

  return (
    <section className="panel news-panel scroll-target" aria-label="Subspace relay, full-text RSS" id="news">
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
              title="Refresh channel"
              aria-label="Refresh subspace channel"
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
            <nav className="news-feed-breadcrumb" aria-label="Subspace relay navigation">
              <button type="button" className="news-feed-breadcrumb__crumb" onClick={closeArticle}>
                Subspace relay
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

            <div className="news-reader-panel-scroll">
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
                      title="Back to relay list"
                      aria-label="Back to subspace relay list"
                    >
                      ×
                    </button>
                    <a
                      className="news-reader-external"
                      href={articleReader.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open at source
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
                    This story could not be sanitized for in-app display. Open at source.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="news-rss-controls">
              <div className="market-panel-tabs news-feed-tabs" role="tablist" aria-label="Saved subspace channels">
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
                  placeholder="Full-text channel URL (e.g. Substack …/feed)"
                  autoComplete="off"
                  value={feedInput}
                  onChange={(ev) => setFeedInput(ev.target.value)}
                />
                <button type="submit">Add channel</button>
              </form>
              {rssUrls.length > 0 && activeRssUrl ? (
                <button type="button" className="news-rss-remove" onClick={removeActiveFeed}>
                  Remove current channel
                </button>
              ) : null}
              <p className="news-rss-hint">
                Full article view needs HTML in the feed (<code>content:encoded</code> or rich <code>description</code>).
                Headline-only wires still show a preview blurb when the feed includes a summary.
              </p>
              {rssError ? <p className="news-rss-error">{rssError}</p> : null}
            </div>

            <div className="news-list-scroll" aria-busy={rssLoading}>
              {rssLoading ? (
                <p className="news-rss-loading">Scanning subspace channels…</p>
              ) : !activeRssUrl ? (
                <p className="news-rss-loading">Add a relay URL above.</p>
              ) : displayItems.length === 0 ? (
                <p className="news-rss-loading">
                  No entries with a readable preview or article body. Try another channel or a source that publishes full
                  HTML in RSS.
                </p>
              ) : (
                <ul className="news-list" role="list">
                  {displayItems.map((item) => {
                    const inline = sanitizableArticleHtml(item) !== null;
                    const href = canonicalArticleUrl(item.link) ?? item.link;
                    const scanCue = "Scan document";

                    const body = (
                      <>
                        <div className="subspace-feed-card__eyebrow">{item.source}</div>
                        <h3 className="subspace-feed-card__title">{item.title}</h3>
                        {item.excerpt ? <p className="subspace-feed-card__excerpt">{item.excerpt}</p> : null}
                        <div className="subspace-feed-card__actions" aria-hidden="true">
                          <span className="subspace-feed-scan-hint">{scanCue}</span>
                        </div>
                      </>
                    );

                    return (
                      <li key={`r-${item.link}-${item.title}`}>
                        {inline ? (
                          <button
                            type="button"
                            className="subspace-feed-card"
                            onClick={() => handleReadMore(item)}
                            aria-label={`${scanCue}: ${item.title}`}
                          >
                            {body}
                          </button>
                        ) : (
                          <a
                            className="subspace-feed-card"
                            href={href}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label={`${scanCue}: ${item.title} (opens in new tab)`}
                          >
                            {body}
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
