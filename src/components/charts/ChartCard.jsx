import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";

// A card with a title and a switch between the chart and a plain table of the same numbers.
export default function ChartCard({ title, subtitle, table, action, className = "", children }) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section className={`card chart-card ${className}`}>
      <div className="chart-card-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        <div className="chart-card-actions">
          {action}
          {table && (
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowTable(!showTable)}
              aria-pressed={showTable}
              title={showTable ? "Show chart" : "Show as table"}
            >
              {showTable ? <BarChart3 size={16} aria-hidden /> : <Table2 size={16} aria-hidden />}
              <span>{showTable ? "Chart" : "Table"}</span>
            </button>
          )}
        </div>
      </div>
      {showTable && table ? <div className="chart-table">{table}</div> : children}
    </section>
  );
}
