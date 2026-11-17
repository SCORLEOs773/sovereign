import { startCampaign } from "../sim/simClient";
import { useGameStore } from "../store/gameStore";
import { useUiStore } from "../store/uiStore";
import { CountryPanel } from "./CountryPanel";
import { WorldMap } from "./WorldMap";

export function SetupScreen() {
  const setScreen = useUiStore((s) => s.setScreen);
  const regenerateWorld = useGameStore((s) => s.regenerateWorld);
  const seed = useGameStore((s) => s.world.seed);

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn" onClick={() => setScreen("menu")}>
          ← Back
        </button>
        <span className="brand-title">Choose your nation</span>
        <div className="spacer" />
        <span className="seed">World seed {seed}</span>
        <button className="btn" onClick={regenerateWorld}>
          Re-roll world (dev)
        </button>
      </header>
      <div className="workspace">
        <WorldMap />
        <CountryPanel onPlay={startCampaign} />
      </div>
    </div>
  );
}
