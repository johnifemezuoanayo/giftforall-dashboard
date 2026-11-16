import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { formatNumber } from "./charts/chartHelpers.js";

function Change({ now, before, period }) {
  const difference = now - before;
  if (difference === 0) {
    return (
      <p className="stat-change">
        <ArrowRight size={14} className="change-flat" aria-hidden />
        <span>Same as {period}</span>
      </p>
    );
  }

  const up = difference > 0;
  const percent = before > 0 ? ` (${up ? "+" : "−"}${Math.round((Math.abs(difference) / before) * 100)}%)` : "";
  return (
    <p className="stat-change">
      {up ? <ArrowUpRight size={14} className="change-up" aria-hidden /> : <ArrowDownRight size={14} className="change-down" aria-hidden />}
      <span>
        <strong>
          {up ? "+" : "−"}
          {formatNumber(Math.abs(difference))}
          {percent}
        </strong>{" "}
        vs {period}
      </span>
    </p>
  );
}

export default function StatTile({ icon: Icon, label, value, change, note, to }) {
  const content = (
    <>
      <p className="stat-label">
        {Icon && <Icon size={16} aria-hidden />}
        {label}
      </p>
      <p className={`stat-value ${typeof value === "number" ? "" : "is-text"}`}>{typeof value === "number" ? formatNumber(value) : value}</p>
      {change && <Change {...change} />}
      {note && <p className="stat-note">{note}</p>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="card stat-tile is-link">
        {content}
      </Link>
    );
  }
  return <div className="card stat-tile">{content}</div>;
}
