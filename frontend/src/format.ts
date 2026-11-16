const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatCompact = (n: number): string => compact.format(n);
export const formatMoney = (n: number): string => `$${compact.format(n)}`;
export const formatPercent = (n: number): string => `${Math.round(n)}%`;
export const toCssColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;
