"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { playErrorBeep, playSubmitBeep } from "@/lib/button-beep";
import {
  SET_MARKET_TELEMETRY_SYMBOL_EVENT,
  type SetMarketTelemetrySymbolDetail,
} from "@/lib/market-telemetry-bridge";
import { formatQuotePercent, formatQuotePrice } from "@/lib/quote-format";

import { MarketChart } from "@/components/MarketChart";

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

const DEFAULT_SYMBOL = "BTC-USD";
const STORAGE_KEY = "kewldashboard.marketTelemetry.v1";
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9:.\^_-]{1,31}$/;

function normalizeSymbol(raw: string) {
  return raw.trim().toUpperCase();
}

function displayTitle(symbol: string) {
  const parts = symbol.split(":");
  return parts.length > 1 ? parts[parts.length - 1]! : symbol;
}

type MarketDetailTab = "quote" | "chart";

export function MarketPanel() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [input, setInput] = useState(DEFAULT_SYMBOL);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detailTab, setDetailTab] = useState<MarketDetailTab>("quote");
  const userSetSymbolRef = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as unknown;
      if (typeof parsed === "string") {
        const next = normalizeSymbol(parsed);
        if (SYMBOL_PATTERN.test(next)) {
          setSymbol(next);
          setInput(next);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(symbol));
  }, [symbol]);

  useEffect(() => {
    function onSetSymbol(event: Event) {
      const ce = event as CustomEvent<SetMarketTelemetrySymbolDetail>;
      const raw = ce.detail?.symbol;
      if (typeof raw !== "string") {
        return;
      }
      const next = normalizeSymbol(raw);
      if (!SYMBOL_PATTERN.test(next)) {
        return;
      }
      userSetSymbolRef.current = true;
      setSymbol(next);
      setInput(next);
      setDetailTab("quote");
      document.getElementById("markets")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    window.addEventListener(SET_MARKET_TELEMETRY_SYMBOL_EVENT, onSetSymbol);
    return () => {
      window.removeEventListener(SET_MARKET_TELEMETRY_SYMBOL_EVENT, onSetSymbol);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const shouldChimeError = userSetSymbolRef.current;
      userSetSymbolRef.current = false;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/watchlist?symbols=${encodeURIComponent(symbol)}`);
        const data = (await response.json()) as WatchlistResponse;

        if (!response.ok || data.error) {
          throw new Error(data.error ?? "Quote unavailable");
        }

        const next = data.quotes[0] ?? null;
        if (!cancelled) {
          setQuote(next);
          if (!next) {
            setError("No quote returned for this symbol.");
            if (shouldChimeError) {
              playErrorBeep();
            }
          }
        }
      } catch (caught) {
        if (!cancelled) {
          setQuote(null);
          setError(caught instanceof Error ? caught.message : "Quote unavailable");
          if (shouldChimeError) {
            playErrorBeep();
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    const interval = window.setInterval(load, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [symbol]);

  function applySymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = normalizeSymbol(input);
    if (SYMBOL_PATTERN.test(next)) {
      playSubmitBeep();
      userSetSymbolRef.current = true;
      setSymbol(next);
      setDetailTab("quote");
    } else {
      playErrorBeep();
    }
  }

  const changePercent = quote?.changePercent ?? null;
  const pctClass =
    changePercent === null ? "market-quote-pct-flat" : changePercent >= 0 ? "market-quote-pct-up" : "market-quote-pct-down";

  return (
    <section
      id="markets"
      className="panel widget-panel market-panel scroll-target"
      aria-label={`Market telemetry for ${symbol}`}
    >
      <div className="panel-heading market-panel-heading">
        <div>
          <span>Market Telemetry</span>
          <strong>{quote?.symbol ? displayTitle(quote.symbol) : displayTitle(symbol)}</strong>
        </div>
        <form className="market-telemetry-form" onSubmit={applySymbol}>
          <label className="sr-only" htmlFor="market-telemetry-symbol">
            Ticker symbol for market telemetry
          </label>
          <input
            id="market-telemetry-symbol"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="NDX, BTC-USD, NASDAQ:NDX"
            maxLength={32}
            spellCheck={false}
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <button type="submit">Set</button>
        </form>
      </div>

      <div className="market-quote-body">
        <div className="market-panel-tabs" role="tablist" aria-label="Market telemetry view">
          <button
            type="button"
            role="tab"
            id="market-tab-quote"
            aria-selected={detailTab === "quote"}
            aria-controls="market-panel-quote"
            tabIndex={detailTab === "quote" ? 0 : -1}
            className={detailTab === "quote" ? "is-active" : undefined}
            onClick={() => setDetailTab("quote")}
          >
            Quote
          </button>
          <button
            type="button"
            role="tab"
            id="market-tab-chart"
            aria-selected={detailTab === "chart"}
            aria-controls="market-panel-chart"
            tabIndex={detailTab === "chart" ? 0 : -1}
            className={detailTab === "chart" ? "is-active" : undefined}
            onClick={() => setDetailTab("chart")}
          >
            Chart
          </button>
        </div>

        {detailTab === "quote" ? (
          <div id="market-panel-quote" role="tabpanel" aria-labelledby="market-tab-quote">
            {isLoading && !quote ? (
              <p className="market-quote-status">Syncing quote…</p>
            ) : null}
            {error ? <p className="market-quote-error">{error}</p> : null}
            {quote ? (
              <div className="market-quote-grid">
                <div className="market-quote-primary">
                  <p className="market-quote-price">{formatQuotePrice(quote.price, quote.currency)}</p>
                  <p className={`market-quote-pct ${pctClass}`}>{formatQuotePercent(quote.changePercent)}</p>
                </div>
                <p className="market-quote-name">{quote.name}</p>
                <dl className="market-quote-meta">
                  <div>
                    <dt>Symbol</dt>
                    <dd>{quote.symbol}</dd>
                  </div>
                  {quote.quoteType ? (
                    <div>
                      <dt>Type</dt>
                      <dd>{quote.quoteType}</dd>
                    </div>
                  ) : null}
                  {quote.change !== null ? (
                    <div>
                      <dt>Change</dt>
                      <dd>
                        {quote.change >= 0 ? "+" : ""}
                        {quote.change.toFixed(quote.currency === "USD" && Math.abs(quote.change) >= 1 ? 2 : 4)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}
          </div>
        ) : (
          <div id="market-panel-chart" role="tabpanel" aria-labelledby="market-tab-chart">
            <MarketChart symbol={quote?.symbol ?? symbol} currency={quote?.currency} />
          </div>
        )}
      </div>
    </section>
  );
}
