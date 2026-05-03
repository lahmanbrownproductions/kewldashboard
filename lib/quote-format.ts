/** Compact numeric/currency strings for narrow chart axes. */
export function formatAxisPrice(price: number, currency: string | undefined) {
  const curr = currency || "";
  const abs = Math.abs(price);
  const options: Intl.NumberFormatOptions =
    abs >= 100
      ? { maximumFractionDigits: 2 }
      : abs >= 1
        ? { maximumFractionDigits: 2, minimumFractionDigits: abs % 1 === 0 ? 0 : 2 }
        : { maximumFractionDigits: 4 };

  if (curr) {
    return new Intl.NumberFormat("en-US", {
      ...options,
      currency: curr,
      notation: abs >= 10_000 ? "compact" : "standard",
      style: "currency",
    }).format(price);
  }

  return new Intl.NumberFormat("en-US", { ...options, style: "decimal" }).format(price);
}

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
