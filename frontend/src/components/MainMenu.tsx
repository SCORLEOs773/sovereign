import { useEffect, useState } from "react";
import {
  GAME_NAME,
  GAME_SUBTITLE,
  GAME_TAGLINE,
  GAME_VERSION,
} from "@sovereign/shared";
import { fetchHealth } from "../api";
import { continueCampaign } from "../sim/simClient";
import { useUiStore } from "../store/uiStore";

export function MainMenu() {
  const hasSave = useUiStore((s) => s.hasSave);
  const setScreen = useUiStore((s) => s.setScreen);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  const newCampaign = (): void => {
    if (
      hasSave &&
      !window.confirm(
        "Starting a new campaign replaces your saved game. Continue?",
      )
    )
      return;
    setScreen("setup");
  };

  const statusClass = online === null ? "" : online ? "online" : "offline";
  const statusText =
    online === null
      ? "Connecting…"
      : online
        ? "Backend online"
        : "Backend offline";

  return (
    <div className="menu">
      <div className="menu-inner">
        <h1 className="menu-title">{GAME_NAME}</h1>
        <h2 className="menu-sub">{GAME_SUBTITLE}</h2>
        <p className="menu-tag">{GAME_TAGLINE}</p>
        <div className="menu-buttons">
          <button
            className="btn-primary"
            disabled={!hasSave}
            onClick={continueCampaign}
          >
            Continue campaign
          </button>
          <button className="btn-primary" onClick={newCampaign}>
            New campaign
          </button>
        </div>
        <p className="menu-foot">
          <span className={`dot ${statusClass}`} /> {statusText} · v
          {GAME_VERSION}
        </p>
      </div>
    </div>
  );
}
