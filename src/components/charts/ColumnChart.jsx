import { useEffect, useRef, useState } from "react";
import { formatDay, formatNumber } from "./chartHelpers.js";

const MARGIN = { top: 22, right: 8, bottom: 28, left: 40 };

// Round numbers for the side axis, like 0 / 5 / 10 / 15.
function makeTicks(maxValue) {
  if (maxValue <= 0) return [0, 1];
  const roughStep = maxValue / 4;
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const niceStep = [1, 2, 5, 10].map((size) => size * power).find((size) => size >= roughStep);
  // Counts are whole numbers, so ticks never go below steps of 1.
  const step = Math.max(1, niceStep);
  const ticks = [];
  for (let value = 0; value < maxValue + step; value += step) ticks.push(Math.round(value));
  return ticks;
}

// A column shape with a rounded top and a square bottom.
function columnPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

export default function ColumnChart({ data, label, unit, height = 240, emptyText = "Nothing yet in this period." }) {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const values = data.map((item) => item.count);
  const maxValue = Math.max(0, ...values);
  const ticks = makeTicks(maxValue);
  const top = ticks[ticks.length - 1];
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const band = plotWidth / Math.max(1, data.length);
  const barWidth = Math.max(1, Math.min(24, band - 2));
  const peakIndex = maxValue > 0 ? values.lastIndexOf(maxValue) : -1;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotWidth / 70))));

  const xFor = (index) => MARGIN.left + index * band + (band - barWidth) / 2;
  const yFor = (value) => MARGIN.top + plotHeight - (value / top) * plotHeight;

  function handleKey(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setActive((current) => {
      const start = current ?? data.length - 1;
      if (event.key === "Home") return 0;
      if (event.key === "End") return data.length - 1;
      if (event.key === "ArrowLeft") return Math.max(0, start - 1);
      return Math.min(data.length - 1, start + 1);
    });
  }

  const activeItem = active === null ? null : data[active];
  const tooltipLeft = active === null ? 0 : Math.min(Math.max(xFor(active) + barWidth / 2, 70), width - 70);

  return (
    <div className="column-chart" ref={boxRef}>
      <svg
        width={width}
        height={height}
        role="group"
        aria-label={`${label}. Use the left and right arrow keys to read each day.`}
        tabIndex={0}
        onKeyDown={handleKey}
        onFocus={() => setActive((current) => current ?? data.length - 1)}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yFor(tick)} y2={yFor(tick)} className="chart-grid" />
            <text x={MARGIN.left - 8} y={yFor(tick)} className="chart-axis-text" textAnchor="end" dominantBaseline="middle">
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        {data.map((item, index) => {
          if (item.count === 0) return null;
          const barHeight = Math.max(1, (item.count / top) * plotHeight);
          return (
            <path
              key={item.date}
              d={columnPath(xFor(index), yFor(item.count), barWidth, barHeight, 4)}
              className={`chart-column ${active === index ? "is-active" : ""}`}
            />
          );
        })}

        {peakIndex >= 0 && active === null && (
          <text x={xFor(peakIndex) + barWidth / 2} y={yFor(maxValue) - 7} className="chart-peak-label" textAnchor="middle">
            {formatNumber(maxValue)}
          </text>
        )}

        {data.map((item, index) => {
          const isLast = index === data.length - 1;
          const tooCloseToLast = data.length - 1 - index < labelEvery * 0.7;
          return isLast || (index % labelEvery === 0 && !tooCloseToLast) ? (
            <text
              key={`label-${item.date}`}
              x={xFor(index) + barWidth / 2}
              y={height - 8}
              className="chart-axis-text"
              textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
            >
              {isLast ? "Today" : formatDay(item.date)}
            </text>
          ) : null;
        })}

        {data.map((item, index) => (
          <rect
            key={`hit-${item.date}`}
            x={MARGIN.left + index * band}
            y={MARGIN.top}
            width={band}
            height={plotHeight}
            fill="transparent"
            onPointerEnter={() => setActive(index)}
          />
        ))}
      </svg>

      {maxValue === 0 && <p className="chart-empty">{emptyText}</p>}

      {activeItem && (
        <div className="chart-tooltip" style={{ left: tooltipLeft }} aria-hidden="true">
          <strong>
            {formatNumber(activeItem.count)} {activeItem.count === 1 ? unit[0] : unit[1]}
          </strong>
          <span>{formatDay(activeItem.date, true)}</span>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {activeItem ? `${formatDay(activeItem.date, true)}: ${activeItem.count} ${activeItem.count === 1 ? unit[0] : unit[1]}` : ""}
      </p>
    </div>
  );
}
