import { useSimStore } from "../store/simStore";
import { GameOverModal } from "./GameOverModal";
import { GamePanel } from "./GamePanel";
import { GameTopBar } from "./GameTopBar";
import { OfflineBanner } from "./OfflineBanner";
import { WorldMap } from "./WorldMap";

export function GameScreen() {
  const state = useSimStore((s) => s.state);
  const nation = state ? state.nations[state.playerCountryId] : undefined;

  if (!state || !nation) {
    return <div className="app center">Loading…</div>;
  }

  return (
    <div className="app">
      <GameTopBar nation={nation} />
      <div className="workspace">
        <WorldMap />
        <GamePanel state={state} nation={nation} />
      </div>
      <OfflineBanner />
      {state.gameOver && <GameOverModal gameOver={state.gameOver} />}
    </div>
  );
}
