"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import {
  CHART_RANGE_PRESETS,
  DEFAULT_CHART_PRESET_ID,
  getChartPreset,
} from "@/lib/chart-range-presets";
import { formatAxisPrice } from "@/lib/quote-format";

type Point = { t: number; c: number };

type ChartResponse = {
  error?: string;
  points: Point[];
  range?: string;
  interval?: string;
};

const VIEW_W = 426;
const VIEW_H = 168;
/** Space for formatted price labels along the vertical axis */
const LABEL_W = 54;
/** Left edge of plot (after axis labels); right padding balances the frame */
const PLOT_LEFT = LABEL_W + 6;
const PAD_R = 10;
/** Plot vertical bounds (room for top/bottom tick labels) */
const PLOT_TOP = 12;
const PLOT_BOTTOM = 150;
const AXIS_Y = 156;

const Y_TICK_COUNT = 5;

export function MarketChart({ symbol, currency }: { symbol: string; currency?: string }) {
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
    const plotW = VIEW_W - PLOT_LEFT - PAD_R;
    const plotH = PLOT_BOTTOM - PLOT_TOP;

    const xAt = (i: number) => PLOT_LEFT + (i / (points.length - 1)) * plotW;
    const yAt = (price: number) => PLOT_TOP + (1 - (price - min) / span) * plotH;

    const yTicks = Array.from(
      { length: Y_TICK_COUNT },
      (_, i) => max - (i / (Y_TICK_COUNT - 1)) * (max - min),
    );

    const axisSummary = `${formatAxisPrice(min, currency)} to ${formatAxisPrice(max, currency)}`;

    const lineD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.c).toFixed(1)}`)
      .join(" ");
    const areaD = `${lineD} L ${xAt(points.length - 1).toFixed(1)} ${AXIS_Y} L ${PLOT_LEFT} ${AXIS_Y} Z`;

    chartBody = (
      <svg
        className="market-chart-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Price chart for ${symbol}, ${activePreset.caption}, ${axisSummary}`}
      >
        <title>{`Adjusted close from ${axisSummary.replace(" to ", " through ")}`}</title>
        <defs>
          <linearGradient id={fillGradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines at price ticks */}
        <g aria-hidden="true">
          {yTicks.map((price, i) => (
            <line
              key={`grid-${price}-${i}`}
              className="market-chart-grid-line"
              x1={PLOT_LEFT}
              y1={yAt(price)}
              x2={VIEW_W - PAD_R}
              y2={yAt(price)}
            />
          ))}
        </g>

        <path d={areaD} fill={`url(#${fillGradientId})`} />
        <path
          d={lineD}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <g aria-hidden="true">
          {yTicks.map((price, i) => (
            <text
              key={`ylab-${price}-${i}`}
              className="market-chart-y-tick-label"
              x={LABEL_W}
              y={yAt(price)}
              dominantBaseline="middle"
              textAnchor="end"
            >
              {formatAxisPrice(price, currency)}
            </text>
          ))}
        </g>

        <line
          x1={PLOT_LEFT}
          y1={AXIS_Y}
          x2={VIEW_W - PAD_R}
          y2={AXIS_Y}
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
        {hasRenderableChart ? ` · Adjusted close · ${symbol}` : ""}
      </p>
    </div>
  );
}
