export type ChartRangePreset = {
  id: string;
  label: string;
  range: string;
  interval: string;
  caption: string;
};

/** Yahoo chart API range/interval pairs that usually work together. */
export const CHART_RANGE_PRESETS: ChartRangePreset[] = [
  { id: "1d", label: "1D", range: "1d", interval: "5m", caption: "1 day · 5 min" },
  { id: "5d", label: "5D", range: "5d", interval: "15m", caption: "5 days · 15 min" },
  { id: "1mo", label: "1M", range: "1mo", interval: "1d", caption: "1 month · daily" },
  { id: "3mo", label: "3M", range: "3mo", interval: "1d", caption: "3 months · daily" },
  { id: "6mo", label: "6M", range: "6mo", interval: "1d", caption: "6 months · daily" },
  { id: "1y", label: "1Y", range: "1y", interval: "1d", caption: "1 year · daily" },
  { id: "2y", label: "2Y", range: "2y", interval: "1d", caption: "2 years · daily" },
];

export const DEFAULT_CHART_PRESET_ID = "3mo";

export function getChartPreset(id: string): ChartRangePreset | undefined {
  return CHART_RANGE_PRESETS.find((p) => p.id === id);
}
