import { useEffect, useState } from "react";
import { GAME_NAME, GAME_SUBTITLE, GAME_VERSION } from "@sovereign/shared";
import { fetchHealth } from "../api";
import { startNewCampaign } from "../sim/simClient";
import { useGameStore } from "../store/gameStore";
import { ClockControls } from "./ClockControls";

export function TopBar() {
  const seed = useGameStore((s) => s.world.seed);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  const statusClass = online === null ? "" : online ? "online" : "offline";
  const statusText =
    online === null
      ? "Connecting…"
      : online
        ? "Backend online"
        : "Backend offline";

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-title">{GAME_NAME}</span>
        <span className="brand-sub">{GAME_SUBTITLE}</span>
      </div>
      <div className="spacer" />
      <ClockControls />
      <div className="spacer" />
      <span className="seed">World seed {seed}</span>
      <button className="btn" onClick={startNewCampaign}>
        New campaign (dev)
      </button>
      <span className="status">
        <span className={`dot ${statusClass}`} />
        {statusText} · v{GAME_VERSION}
      </span>
    </header>
  );
}
