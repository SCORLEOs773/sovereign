import { useEffect, useState } from "react";
import { setSpeed, startCampaign } from "../sim/simClient";
import { useGameStore } from "../store/gameStore";
import { useUiStore } from "../store/uiStore";
import { CountryPanel } from "./CountryPanel";
import { WorldMap } from "./WorldMap";

export function SetupScreen() {
  const setScreen = useUiStore((s) => s.setScreen);
  const regenerateWorld = useGameStore((s) => s.regenerateWorld);
  const setWorldSeed = useGameStore((s) => s.setWorldSeed);
  const seed = useGameStore((s) => s.world.seed);
  const [seedText, setSeedText] = useState(String(seed));

  // A fresh planet every time a new campaign is set up
  useEffect(() => {
    regenerateWorld();
  }, [regenerateWorld]);

  useEffect(() => {
    setSeedText(String(seed));
  }, [seed]);

  const useSeed = (): void => {
    const value = Number.parseInt(seedText, 10);
    if (Number.isFinite(value) && value >= 0)
      setWorldSeed(Math.min(value, 2_000_000_000));
  };

  // Start paused so the inauguration briefing can appear before time begins
  const play = (countryId: number): void => {
    startCampaign(countryId);
    setSpeed(0);
    useUiStore.getState().setBriefingOpen(true);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn" onClick={() => setScreen("menu")}>
          ← Back
        </button>
        <span className="brand-title">Choose your nation</span>
        <div className="spacer" />
        <span className="seed">Planet seed</span>
        <input
          value={seedText}
          onChange={(e) => setSeedText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") useSeed();
          }}
          inputMode="numeric"
          aria-label="Planet seed"
          style={{
            width: 110,
            background: "var(--panel-2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: "0.8rem",
          }}
        />
        <button className="btn" onClick={useSeed}>
          Use seed
        </button>
        <button className="btn" onClick={regenerateWorld}>
          🎲 New world
        </button>
      </header>
      <div className="workspace">
        <WorldMap />
        <CountryPanel onPlay={play} />
      </div>
    </div>
  );
}
