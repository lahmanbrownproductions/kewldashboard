"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import {
  CHART_RANGE_PRESETS,
  DEFAULT_CHART_PRESET_ID,
  getChartPreset,
} from "@/lib/chart-range-presets";

type Point = { t: number; c: number };

type ChartResponse = {
  error?: string;
  points: Point[];
  range?: string;
  interval?: string;
};

const VIEW_W = 400;
const VIEW_H = 168;
const PAD = 10;

export function MarketChart({ symbol }: { symbol: string }) {
  const fillGradientId = `market-chart-fill-${useId().replace(/:/g, "")}`;
  const [presetId, setPresetId] = useState(DEFAULT_CHART_PRESET_ID);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activePreset = useMemo(
    () => getChartPreset(presetId) ?? CHART_RANGE_PRESETS[3]!,
    [presetId],
  );

  useEffect(() => {
    let cancelled = false;
    const { range, interval } = activePreset;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ symbol, range, interval });
        const response = await fetch(`/api/chart?${params}`);
        const data = (await response.json()) as ChartResponse;

        if (!response.ok || data.error) {
          throw new Error(data.error ?? "Chart unavailable");
        }

        if (!cancelled) {
          setPoints(data.points ?? []);
        }
      } catch (caught) {
        if (!cancelled) {
          setPoints([]);
          setError(caught instanceof Error ? caught.message : "Chart unavailable");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [symbol, activePreset.range, activePreset.interval]);

  const hasRenderableChart = !loading && !error && points.length >= 2;

  let chartBody: ReactNode;
  if (loading) {
    chartBody = <p className="market-chart-status">Loading chart…</p>;
  } else if (error) {
    chartBody = <p className="market-chart-error">{error}</p>;
  } else if (points.length < 2) {
    chartBody = <p className="market-chart-status">Not enough history for this symbol.</p>;
  } else {
    const closes = points.map((p) => p.c);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const innerW = VIEW_W - 2 * PAD;
    const innerH = VIEW_H - 2 * PAD;

    const xAt = (i: number) => PAD + (i / (points.length - 1)) * innerW;
    const yAt = (price: number) => PAD + (1 - (price - min) / span) * innerH;

    const lineD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.c).toFixed(1)}`)
      .join(" ");
    const areaD = `${lineD} L ${xAt(points.length - 1).toFixed(1)} ${VIEW_H - PAD} L ${PAD} ${VIEW_H - PAD} Z`;

    chartBody = (
      <svg
        className="market-chart-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Price chart for ${symbol}, ${activePreset.caption}`}
      >
        <defs>
          <linearGradient id={fillGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${fillGradientId})`} />
        <path
          d={lineD}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1={PAD}
          y1={VIEW_H - PAD}
          x2={VIEW_W - PAD}
          y2={VIEW_H - PAD}
          stroke="rgba(141, 172, 214, 0.35)"
          strokeWidth={1}
        />
      </svg>
    );
  }

  return (
    <div className="market-chart-wrap">
      <div className="market-chart-ranges" role="tablist" aria-label="Chart date range">
        {CHART_RANGE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={presetId === p.id}
            aria-controls="market-chart-panel"
            tabIndex={presetId === p.id ? 0 : -1}
            className={presetId === p.id ? "is-active" : undefined}
            onClick={() => setPresetId(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div id="market-chart-panel" role="tabpanel" aria-label={`Chart data, ${activePreset.caption}`}>
        {chartBody}
      </div>

      <p className="market-chart-caption">
        {activePreset.caption}
        {hasRenderableChart ? ` · ${symbol}` : ""}
      </p>
    </div>
  );
}
