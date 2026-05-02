import { NextResponse } from "next/server";

type YahooChartHistory = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
        }>;
      };
      meta?: {
        currency?: string;
        symbol?: string;
      };
    }>;
    error?: { description?: string };
  };
};

const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9:.\^_-]{1,31}$/;
const ALLOWED_RANGES = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max"]);
const ALLOWED_INTERVALS = new Set([
  "1m",
  "2m",
  "5m",
  "15m",
  "30m",
  "60m",
  "90m",
  "1h",
  "1d",
  "5d",
  "1wk",
  "1mo",
  "3mo",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const range = searchParams.get("range") ?? "3mo";
  const interval = searchParams.get("interval") ?? "1d";

  if (!SYMBOL_PATTERN.test(rawSymbol)) {
    return NextResponse.json({ error: "Invalid symbol", points: [] }, { status: 400 });
  }

  if (!ALLOWED_RANGES.has(range)) {
    return NextResponse.json({ error: "Invalid range", points: [] }, { status: 400 });
  }

  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json({ error: "Invalid interval", points: [] }, { status: 400 });
  }

  try {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(rawSymbol)}`);
    url.searchParams.set("range", range);
    url.searchParams.set("interval", interval);

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 kewldashboard/1.0",
      },
      next: { revalidate: 120 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Chart data unavailable", points: [] }, { status: 502 });
    }

    const data = (await response.json()) as YahooChartHistory;
    const yErr = data.chart?.error;
    if (yErr) {
      return NextResponse.json(
        { error: typeof yErr.description === "string" ? yErr.description : "Chart error", points: [] },
        { status: 404 },
      );
    }

    const result = data.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const meta = result?.meta;

    const points: { t: number; c: number }[] = [];
    for (let i = 0; i < Math.min(timestamps.length, closes.length); i += 1) {
      const t = timestamps[i];
      const c = closes[i];
      if (typeof t === "number" && typeof c === "number" && Number.isFinite(c)) {
        points.push({ t, c });
      }
    }

    return NextResponse.json({
      symbol: meta?.symbol ?? rawSymbol,
      currency: meta?.currency ?? "USD",
      range,
      interval,
      points,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Chart service unavailable", points: [] }, { status: 502 });
  }
}
