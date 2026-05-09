"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ButtonHTMLAttributes, CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

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
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9:.\^_-]{1,31}$/;

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

type WatchlistRowProps = {
  symbol: string;
  quote: Quote | undefined;
  onRemove: () => void;
  onOpenMarketTelemetry: () => void;
  outerRef?: (node: HTMLElement | null) => void;
  outerStyle?: CSSProperties;
  isDragging?: boolean;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  dragDisabled?: boolean;
};

function WatchlistRow({
  symbol,
  quote,
  onRemove,
  onOpenMarketTelemetry,
  outerRef,
  outerStyle,
  isDragging = false,
  dragHandleProps,
  dragDisabled = false,
}: WatchlistRowProps) {
  const changePercent = quote?.changePercent ?? null;
  const directionClass = changePercent === null ? "is-flat" : changePercent >= 0 ? "is-up" : "is-down";

  return (
    <article
      ref={outerRef}
      style={outerStyle}
      className="watchlist-row"
      role="listitem"
      data-dragging={isDragging ? "true" : undefined}
    >
      <button
        type="button"
        className="watchlist-drag-handle"
        aria-label={`Reorder ${symbol}`}
        title="Drag to reorder"
        disabled={dragDisabled}
        {...dragHandleProps}
      >
        <span aria-hidden="true" className="watchlist-drag-glyph" />
      </button>
      <button
        type="button"
        className="watchlist-remove-btn"
        aria-label={`Remove ${symbol}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        x
      </button>
      <button
        type="button"
        className="watchlist-row-main"
        aria-label={`Open ${symbol} in Market Telemetry`}
        onClick={onOpenMarketTelemetry}
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
}

function SortableWatchlistRow(props: Omit<WatchlistRowProps, "outerRef" | "outerStyle" | "isDragging" | "dragHandleProps" | "dragDisabled">) {
  const { symbol } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: symbol,
  });

  const outerStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : undefined,
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <WatchlistRow
      {...props}
      outerRef={setNodeRef}
      outerStyle={outerStyle}
      isDragging={isDragging}
      dragHandleProps={{ ...attributes, ...listeners }}
      dragDisabled={false}
    />
  );
}

export function WatchlistPanel() {
  const [dragReady, setDragReady] = useState(false);
  const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS);
  const [input, setInput] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const quoteFetchReadyRef = useRef(false);

  const symbolQuery = useMemo(() => symbols.join(","), [symbols]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setDragReady(true);
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    setSymbols((items) => {
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) {
        return items;
      }
      return arrayMove(items, oldIndex, newIndex);
    });
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

      {dragReady ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={symbols} strategy={verticalListSortingStrategy}>
            <div className="watchlist-grid" role="list">
              {symbols.map((symbol) => {
                const quote = quotes.find((item) => item.symbol === symbol);
                return (
                  <SortableWatchlistRow
                    key={symbol}
                    symbol={symbol}
                    quote={quote}
                    onRemove={() => removeSymbol(symbol)}
                    onOpenMarketTelemetry={() => openInMarketTelemetry(symbol)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="watchlist-grid" role="list">
          {symbols.map((symbol) => {
            const quote = quotes.find((item) => item.symbol === symbol);
            return (
              <WatchlistRow
                key={symbol}
                symbol={symbol}
                quote={quote}
                onRemove={() => removeSymbol(symbol)}
                onOpenMarketTelemetry={() => openInMarketTelemetry(symbol)}
                dragDisabled
              />
            );
          })}
        </div>
      )}

      <p className="watchlist-note">
        {error
          ? error
          : `${isLoading ? "Syncing" : "Updated"} ${updatedAt ? new Date(updatedAt).toLocaleTimeString() : "now"} — drag :: handles to reorder; saved locally in this browser.`}
      </p>
    </section>
  );
}
