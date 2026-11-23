import { setSpeed, startCampaign } from "../sim/simClient";
import { useGameStore } from "../store/gameStore";
import { useUiStore } from "../store/uiStore";
import { CountryPanel } from "./CountryPanel";
import { WorldMap } from "./WorldMap";

export function SetupScreen() {
  const setScreen = useUiStore((s) => s.setScreen);
  const regenerateWorld = useGameStore((s) => s.regenerateWorld);
  const seed = useGameStore((s) => s.world.seed);

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
        <span className="seed">World seed {seed}</span>
        <button className="btn" onClick={regenerateWorld}>
          Re-roll world (dev)
        </button>
      </header>
      <div className="workspace">
        <WorldMap />
        <CountryPanel onPlay={play} />
      </div>
    </div>
  );
}
