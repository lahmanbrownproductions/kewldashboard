/** Fired from Market Core watchlist rows so Market Telemetry can show that symbol. */
export const SET_MARKET_TELEMETRY_SYMBOL_EVENT = "kewldashboard:setMarketTelemetrySymbol";

export type SetMarketTelemetrySymbolDetail = { symbol: string };

export function dispatchSetMarketTelemetrySymbol(symbol: string): void {
  window.dispatchEvent(
    new CustomEvent<SetMarketTelemetrySymbolDetail>(SET_MARKET_TELEMETRY_SYMBOL_EVENT, {
      detail: { symbol },
    }),
  );
}
