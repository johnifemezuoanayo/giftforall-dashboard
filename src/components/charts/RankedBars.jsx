import { Link } from "react-router-dom";
import { thumbUrl } from "../../api.js";
import { formatNumber } from "./chartHelpers.js";

// Horizontal bars, biggest first, each with its value at the end.
export default function RankedBars({ items, unit, showThumbs = true }) {
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <ol className="ranked-bars">
      {items.map((item) => (
        <li key={item.id} className="ranked-row">
          {showThumbs && (
            <span className="ranked-thumb" aria-hidden>
              {item.image ? <img src={thumbUrl(item.image)} alt="" /> : <span className="ranked-thumb-empty">/go</span>}
            </span>
          )}
          <div className="ranked-body">
            {item.to ? (
              <Link to={item.to} className="ranked-name">
                {item.label}
              </Link>
            ) : (
              <span className="ranked-name">{item.label}</span>
            )}
            <div className="ranked-track">
              <span className="ranked-bar" style={{ width: `${(item.value / maxValue) * 100}%` }} />
              <span className="ranked-value">
                {formatNumber(item.value)} <span className="muted">{item.value === 1 ? unit[0] : unit[1]}</span>
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
