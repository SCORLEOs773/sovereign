import { SIM_CONFIG } from "@sovereign/shared";
import { useSimStore } from "../store/simStore";

export function OfflineBanner() {
  const offline = useSimStore((s) => s.offline);
  const dismiss = useSimStore((s) => s.dismissOffline);
  if (!offline) return null;

  const days = (offline.ticks * SIM_CONFIG.minutesPerTick) / (60 * 24);

  return (
    <div className="banner">
      <span>
        Welcome back. {days.toFixed(1)} in-game days passed while you were away
        {offline.capped
          ? ` (offline progress is capped at ${SIM_CONFIG.maxOfflineSeconds / 3600} hours)`
          : ""}
        .
      </span>
      <button className="banner-close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
