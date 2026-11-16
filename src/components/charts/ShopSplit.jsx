import { formatNumber, formatShare } from "./chartHelpers.js";

// Each shop keeps the same color no matter how it ranks.
const shops = {
  amazon: { name: "Amazon", color: "var(--series-1)" },
  temu: { name: "Temu", color: "var(--series-2)" },
  own: { name: "Your own links", color: "var(--series-3)" },
  other: { name: "Other", color: "var(--series-other)" },
};

export default function ShopSplit({ rows }) {
  const total = rows.reduce((sum, row) => sum + row.clicks, 0);
  const parts = rows.filter((row) => row.clicks > 0).map((row) => ({ ...row, ...(shops[row.shop] || shops.other) }));

  if (total === 0) return <p className="muted small chart-empty-inline">No clicks in this period yet.</p>;

  const summary = parts.map((part) => `${part.name} ${formatShare(part.clicks, total)}`).join(", ");

  return (
    <div className="shop-split">
      <div className="split-bar" role="img" aria-label={`Clicks by shop: ${summary}`}>
        {parts.map((part) => (
          <span
            key={part.shop}
            className="split-part"
            style={{ flexGrow: part.clicks, background: part.color }}
            title={`${part.name}: ${part.clicks} clicks (${formatShare(part.clicks, total)})`}
          />
        ))}
      </div>
      <ul className="split-list">
        {parts.map((part) => (
          <li key={part.shop}>
            <span className="split-swatch" style={{ background: part.color }} aria-hidden />
            <span className="split-name">{part.name}</span>
            <span className="split-value">{formatNumber(part.clicks)}</span>
            <span className="split-share muted">{formatShare(part.clicks, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
