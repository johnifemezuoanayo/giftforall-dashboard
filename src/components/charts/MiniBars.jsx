// A tiny bar chart of recent days. Today is drawn in the accent color, earlier days in gray.
export default function MiniBars({ values, width = 84, height = 26 }) {
  const maxValue = Math.max(1, ...values);
  const gap = 2;
  const barWidth = (width - gap * (values.length - 1)) / values.length;

  return (
    <svg width={width} height={height} className="mini-bars" aria-hidden="true">
      {values.map((value, index) => {
        const barHeight = value === 0 ? 2 : Math.max(3, (value / maxValue) * height);
        const isToday = index === values.length - 1;
        return (
          <rect
            key={index}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={Math.min(1.5, barWidth / 2)}
            className={value === 0 ? "mini-bar-empty" : isToday ? "mini-bar-today" : "mini-bar"}
          />
        );
      })}
    </svg>
  );
}
