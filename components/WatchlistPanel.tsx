"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { playErrorBeep, playSubmitBeep, playWatchlistRemoveBeep } from "@/lib/button-beep";
import { dispatchSetMarketTelemetrySymbol } from "@/lib/market-telemetry-bridge";
import { formatQuotePercent, formatQuotePrice } from "@/lib/quote-format";

type Quote = {
  change: number | null;
  changePercent: number | null;
  currency: string;
  name: string;
  price: number | null;
  quoteType: string;
  symbol: string;
};

type WatchlistResponse = {
  error?: string;
  quotes: Quote[];
  updatedAt?: string;
};

const DEFAULT_SYMBOLS = ["BTC-USD", "ETH-USD", "SPY", "NVDA", "AAPL", "MSFT"];
const STORAGE_KEY = "kewldashboard.watchlist.v1";
const DRAG_MIME = "application/x-kewldashboard-watchlist-index";
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9:.\^_-]{1,31}$/;

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

export function WatchlistPanel() {
  const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS);
  const [input, setInput] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const quoteFetchReadyRef = useRef(false);
  const dragFromHandleRef = useRef(false);

  const symbolQuery = useMemo(() => symbols.join(","), [symbols]);

  useEffect(() => {
    function clearDragHandleFlag() {
      dragFromHandleRef.current = false;
    }
    window.addEventListener("pointerup", clearDragHandleFlag);
    window.addEventListener("pointercancel", clearDragHandleFlag);
    return () => {
      window.removeEventListener("pointerup", clearDragHandleFlag);
      window.removeEventListener("pointercancel", clearDragHandleFlag);
    };
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as unknown;

      if (Array.isArray(parsed)) {
        const nextSymbols = parsed
          .map((symbol) => (typeof symbol === "string" ? normalizeSymbol(symbol) : ""))
          .filter((symbol) => SYMBOL_PATTERN.test(symbol))
          .slice(0, 12);

        if (nextSymbols.length > 0) {
          setSymbols(Array.from(new Set(nextSymbols)));
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  }, [symbols]);

  useEffect(() => {
    let isCurrent = true;

    async function loadQuotes(fromPeriodicRefresh: boolean) {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/watchlist?symbols=${encodeURIComponent(symbolQuery)}`);
        const data = (await response.json()) as WatchlistResponse;

        if (!response.ok || data.error) {
          throw new Error(data.error ?? "Could not load quote data");
        }

        if (isCurrent) {
          setQuotes(data.quotes);
          setUpdatedAt(data.updatedAt ?? null);
        }
      } catch (caughtError) {
        if (isCurrent) {
          setError(caughtError instanceof Error ? caughtError.message : "Could not load quote data");
          if (!fromPeriodicRefresh && quoteFetchReadyRef.current) {
            playErrorBeep();
          }
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
          quoteFetchReadyRef.current = true;
        }
      }
    }

    void loadQuotes(false);
    const interval = window.setInterval(() => {
      void loadQuotes(true);
    }, 60_000);

    return () => {
      isCurrent = false;
      window.clearInterval(interval);
    };
  }, [symbolQuery]);

  function addSymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const symbol = normalizeSymbol(input);

    if (!SYMBOL_PATTERN.test(symbol) || symbols.includes(symbol)) {
      playErrorBeep();
      setInput("");
      return;
    }

    playSubmitBeep();
    setSymbols((currentSymbols) => [symbol, ...currentSymbols].slice(0, 12));
    setInput("");
  }

  function removeSymbol(symbol: string) {
    playWatchlistRemoveBeep();
    setSymbols((currentSymbols) => currentSymbols.filter((currentSymbol) => currentSymbol !== symbol));
  }

  function reorderSymbols(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return;
    }
    setSymbols((prev) => {
      if (fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function parseDraggedIndex(dataTransfer: DataTransfer): number | null {
    const raw = dataTransfer.getData(DRAG_MIME) || dataTransfer.getData("text/plain");
    const index = Number.parseInt(raw, 10);
    return Number.isFinite(index) ? index : null;
  }

  function onRowDragStart(event: DragEvent<HTMLElement>, index: number) {
    if (!dragFromHandleRef.current) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_MIME, String(index));
    event.dataTransfer.setData("text/plain", String(index));
  }

  function onRowDragEnd() {
    dragFromHandleRef.current = false;
    setDragOverIndex(null);
  }

  function onRowDragOver(event: DragEvent<HTMLElement>, index: number) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }

  function onRowDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragOverIndex(null);
    }
  }

  function onRowDrop(event: DragEvent<HTMLElement>, dropIndex: number) {
    event.preventDefault();
    setDragOverIndex(null);
    const fromIndex = parseDraggedIndex(event.dataTransfer);
    if (fromIndex === null) {
      return;
    }
    reorderSymbols(fromIndex, dropIndex);
  }

  function openInMarketTelemetry(symbol: string) {
    playSubmitBeep();
    dispatchSetMarketTelemetrySymbol(symbol);
  }

  return (
    <section
      id="watchlist"
      className="panel data-bank watchlist-panel scroll-target"
      aria-label="Configurable market watchlist"
    >
      <div className="panel-heading watchlist-heading">
        <div>
          <span>Market Core</span>
          <strong>Stocks / Crypto</strong>
        </div>
        <form className="watchlist-form" onSubmit={addSymbol}>
          <label className="sr-only" htmlFor="watchlist-symbol">
            Add a stock or crypto ticker
          </label>
          <input
            id="watchlist-symbol"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="BTC-USD, TSLA, SPY"
            maxLength={16}
          />
          <button type="submit">Add</button>
        </form>
      </div>

      <div className="watchlist-grid" role="list">
        {symbols.map((symbol, index) => {
          const quote = quotes.find((item) => item.symbol === symbol);
          const changePercent = quote?.changePercent ?? null;
          const directionClass = changePercent === null ? "is-flat" : changePercent >= 0 ? "is-up" : "is-down";

          return (
            <article
              className={`watchlist-row${dragOverIndex === index ? " is-watchlist-drop-target" : ""}`}
              key={symbol}
              role="listitem"
              draggable
              onDragStart={(event) => onRowDragStart(event, index)}
              onDragEnd={onRowDragEnd}
              onDragOver={(event) => onRowDragOver(event, index)}
              onDragLeave={onRowDragLeave}
              onDrop={(event) => onRowDrop(event, index)}
            >
              <button
                type="button"
                className="watchlist-drag-handle"
                aria-label={`Reorder ${symbol}`}
                title="Drag to reorder"
                onPointerDown={() => {
                  dragFromHandleRef.current = true;
                }}
              >
                <span aria-hidden="true" className="watchlist-drag-glyph" />
              </button>
              <button
                type="button"
                className="watchlist-remove-btn"
                aria-label={`Remove ${symbol}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeSymbol(symbol);
                }}
              >
                x
              </button>
              <button
                type="button"
                className="watchlist-row-main"
                aria-label={`Open ${symbol} in Market Telemetry`}
                onClick={() => openInMarketTelemetry(symbol)}
              >
                <div className="watchlist-row-info">
                  <strong>{symbol}</strong>
                  <span>{quote?.name ?? "Waiting for quote"}</span>
                </div>
                <div className="watchlist-row-metrics">
                  <b>{formatQuotePrice(quote?.price ?? null, quote?.currency ?? "USD")}</b>
                  <em className={directionClass}>{formatQuotePercent(changePercent)}</em>
                </div>
              </button>
            </article>
          );
        })}
      </div>

      <p className="watchlist-note">
        {error
          ? error
          : `${isLoading ? "Syncing" : "Updated"} ${updatedAt ? new Date(updatedAt).toLocaleTimeString() : "now"} — drag :: handles to reorder; saved locally in this browser.`}
      </p>
    </section>
  );
}
