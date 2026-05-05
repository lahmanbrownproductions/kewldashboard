"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Bookmark = {
  href: string;
  label: string;
};

const DEFAULT_BOOKMARKS: Bookmark[] = [
  { label: "GitHub", href: "https://github.com" },
  { label: "Gmail", href: "https://mail.google.com" },
  { label: "Calendar", href: "https://calendar.google.com" },
  { label: "YouTube", href: "https://www.youtube.com" },
];

const STORAGE_KEY = "kewldashboard.bookmarks.v1";

function normalizeUrl(raw: string) {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function BookmarksPanel() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(DEFAULT_BOOKMARKS);
  const [labelInput, setLabelInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }

      const restored = parsed
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const label = "label" in item && typeof item.label === "string" ? item.label.trim() : "";
          const href = "href" in item && typeof item.href === "string" ? normalizeUrl(item.href) : "";
          if (!label || !href) {
            return null;
          }
          return { label: label.slice(0, 40), href };
        })
        .filter((item): item is Bookmark => item !== null)
        .slice(0, 12);

      if (restored.length > 0) {
        setBookmarks(restored);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  const canSubmit = useMemo(() => labelInput.trim() && urlInput.trim(), [labelInput, urlInput]);

  function addBookmark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const label = labelInput.trim().slice(0, 40);
    const href = normalizeUrl(urlInput);

    if (!label || !href) {
      setError("Label and URL are required.");
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(href);
    } catch {
      setError("Enter a valid URL (example.com or https://example.com).");
      return;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      setError("Only http and https links are supported.");
      return;
    }

    if (bookmarks.some((bookmark) => bookmark.href === parsed.href || bookmark.label.toLowerCase() === label.toLowerCase())) {
      setError("Bookmark already exists.");
      return;
    }

    setBookmarks((current) => [{ label, href: parsed.href }, ...current].slice(0, 12));
    setLabelInput("");
    setUrlInput("");
  }

  function removeBookmark(href: string) {
    setBookmarks((current) => current.filter((bookmark) => bookmark.href !== href));
  }

  return (
    <section id="bookmarks" className="panel bookmarks-panel scroll-target" aria-label="Website bookmarks">
      <div className="panel-heading watchlist-heading">
        <div>
          <span>Quick Links</span>
          <strong>Website Bookmarks</strong>
        </div>
        <form className="bookmarks-form" onSubmit={addBookmark}>
          <input
            value={labelInput}
            onChange={(event) => setLabelInput(event.target.value)}
            placeholder="Label"
            maxLength={40}
            aria-label="Bookmark label"
          />
          <input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="example.com"
            maxLength={120}
            aria-label="Bookmark URL"
          />
          <button type="submit" disabled={!canSubmit}>
            Add
          </button>
        </form>
      </div>

      {error ? <p className="bookmarks-error">{error}</p> : null}

      <div className="bookmarks-grid" role="list" aria-label="Saved bookmarks">
        {bookmarks.map((bookmark) => (
          <article key={bookmark.href} className="bookmarks-link" role="listitem">
            <a href={bookmark.href} target="_blank" rel="noopener noreferrer">
              <strong>{bookmark.label}</strong>
              <small>{new URL(bookmark.href).hostname.replace(/^www\./, "")}</small>
            </a>
            <button type="button" onClick={() => removeBookmark(bookmark.href)} aria-label={`Remove ${bookmark.label}`}>
              Remove
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
