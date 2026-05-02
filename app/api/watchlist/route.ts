import { NextResponse } from "next/server";

type YahooQuote = {
  chart?: {
    result?: Array<{
      meta?: {
        chartPreviousClose?: number;
        currency?: string;
        fullExchangeName?: string;
        instrumentType?: string;
        longName?: string;
        previousClose?: number;
        regularMarketPrice?: number;
        shortName?: string;
        symbol?: string;
      };
    }>;
  };
};

const MAX_SYMBOLS = 12;
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9:.\^_-]{1,31}$/;

function normalizeSymbols(value: string | null) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => SYMBOL_PATTERN.test(symbol)),
    ),
  ).slice(0, MAX_SYMBOLS);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = normalizeSymbols(searchParams.get("symbols"));

  if (symbols.length === 0) {
    return NextResponse.json({ quotes: [] });
  }

  try {
    const quotes = await Promise.all(
      symbols.map(async (symbol) => {
        const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
        url.searchParams.set("range", "1d");
        url.searchParams.set("interval", "5m");

        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "user-agent": "Mozilla/5.0 kewldashboard/1.0",
          },
          next: { revalidate: 60 },
        });

        if (!response.ok) {
          return null;
        }

        const data = (await response.json()) as YahooQuote;
        const meta = data.chart?.result?.[0]?.meta;
        const price = meta?.regularMarketPrice ?? null;
        const previousClose = meta?.chartPreviousClose ?? meta?.previousClose ?? null;
        const change = price !== null && previousClose !== null ? price - previousClose : null;
        const changePercent = change !== null && previousClose ? (change / previousClose) * 100 : null;

        return {
          change,
          changePercent,
          currency: meta?.currency ?? "USD",
          name: meta?.shortName ?? meta?.longName ?? meta?.fullExchangeName ?? symbol,
          price,
          quoteType: meta?.instrumentType ?? "",
          symbol: meta?.symbol ?? symbol,
        };
      }),
    );

    return NextResponse.json({ quotes: quotes.filter((quote) => quote !== null), updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Quote service unavailable", quotes: [] }, { status: 502 });
  }
}
