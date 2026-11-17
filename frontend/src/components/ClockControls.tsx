import { useEffect, useRef } from "react";
import {
  SIM_SPEEDS,
  formatGameDateTime,
  type SimSpeed,
} from "@sovereign/shared";
import { setSpeed } from "../sim/simClient";
import { useSimStore } from "../store/simStore";

const KEY_SPEEDS: Record<string, SimSpeed> = {
  "1": 1,
  "2": 2,
  "3": 5,
  "4": 10,
};

export function ClockControls() {
  const tick = useSimStore((s) => s.state?.tick ?? 0);
  const speed = useSimStore((s) => s.speed);
  const ready = useSimStore((s) => s.ready);
  const lastRunning = useRef<SimSpeed>(1);

  useEffect(() => {
    if (speed > 0) lastRunning.current = speed;
  }, [speed]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (document.activeElement instanceof HTMLButtonElement)
          document.activeElement.blur();
        const current = useSimStore.getState().speed;
        setSpeed(current === 0 ? lastRunning.current : 0);
        return;
      }
      const mapped = KEY_SPEEDS[e.key];
      if (mapped !== undefined) setSpeed(mapped);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="clock">
      <span className="clock-time">
        {ready ? formatGameDateTime(tick) : "Loading…"}
      </span>
      <div className="speed-buttons">
        {SIM_SPEEDS.map((s) => (
          <button
            key={s}
            className={`speed ${s === speed ? "active" : ""}`}
            onClick={() => setSpeed(s)}
            title={s === 0 ? "Pause (Space)" : `${s}x speed`}
          >
            {s === 0 ? "⏸" : `${s}x`}
          </button>
        ))}
      </div>
    </div>
  );
}
