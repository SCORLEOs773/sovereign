interface Props {
  title: string;
  values: number[];
  format: (value: number) => string;
  color?: string;
}

export function LineChart({ title, values, format, color = "#4f8cff" }: Props) {
  const width = 300;
  const height = 64;
  const pad = 4;
  const last = values[values.length - 1];

  let points = "";
  if (values.length >= 2) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    points = values
      .map((v, i) => {
        const x = pad + (i / (values.length - 1)) * (width - 2 * pad);
        const y = pad + (1 - (v - min) / span) * (height - 2 * pad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <div className="chart">
      <div className="chart-head">
        <span className="label">{title}</span>
        <span>{last === undefined ? "–" : format(last)}</span>
      </div>
      {values.length >= 2 ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="chart-svg"
        >
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div className="muted small">
          Collecting data… (one point per in-game month)
        </div>
      )}
    </div>
  );
}
