export function formatQuotePrice(price: number | null, currency: string) {
  if (price === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    currency: currency || "USD",
    maximumFractionDigits: price >= 100 ? 2 : 4,
    style: currency ? "currency" : "decimal",
  }).format(price);
}

export function formatQuotePercent(changePercent: number | null) {
  if (changePercent === null) {
    return "—";
  }

  return `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`;
}
