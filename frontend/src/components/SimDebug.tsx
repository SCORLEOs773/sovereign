import { useSimStore } from "../store/simStore";

export function SimDebug() {
  const state = useSimStore((s) => s.state);
  return (
    <div className="sim-debug">
      dev · tick {state.tick} · {state.hours} h · {state.days} d ·{" "}
      {state.months} mo
    </div>
  );
}
