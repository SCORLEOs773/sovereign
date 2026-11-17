import type { ReactNode } from "react";

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span>{value}</span>
    </div>
  );
}
