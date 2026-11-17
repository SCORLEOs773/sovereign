import { formatRatio } from "../format";

interface Props {
  label: string;
  value: number;
  baseline: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

/** Values are fractions (0.25 = 25%). The input itself works in percentage points. */
export function PolicySlider({
  label,
  value,
  baseline,
  min,
  max,
  step,
  onChange,
}: Props) {
  return (
    <label className="slider-row">
      <div className="slider-head">
        <span>{label}</span>
        <span className="slider-value">
          {formatRatio(value)}{" "}
          <span className="muted small">(start {formatRatio(baseline)})</span>
        </span>
      </div>
      <input
        type="range"
        min={min * 100}
        max={max * 100}
        step={step * 100}
        value={Number((value * 100).toFixed(3))}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
    </label>
  );
}
