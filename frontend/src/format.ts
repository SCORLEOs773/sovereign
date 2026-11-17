const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatCompact = (n: number): string => compact.format(n);
export const formatMoney = (n: number): string => `$${compact.format(n)}`;
export const formatSignedMoney = (n: number): string =>
  `${n < 0 ? "−" : "+"}$${compact.format(Math.abs(n))}`;
/** For values stored as 0..100 */
export const formatPercent = (n: number): string => `${Math.round(n)}%`;
/** For ratios stored as 0..1 */
export const formatRatio = (ratio: number, digits = 1): string =>
  `${(ratio * 100).toFixed(digits)}%`;
export const toCssColor = (color: number): string =>
  `#${color.toString(16).padStart(6, "0")}`;
