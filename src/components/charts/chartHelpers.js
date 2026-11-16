// Dates come from the backend as "2026-11-09" in the viewer's own time zone.
export function formatDay(dateText, long = false) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, long ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric" });
}

export function formatNumber(value) {
  if (value >= 10000) return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  return new Intl.NumberFormat().format(value);
}

export function formatShare(part, whole) {
  if (!whole) return "0%";
  const share = (part / whole) * 100;
  return share > 0 && share < 1 ? "<1%" : `${Math.round(share)}%`;
}
