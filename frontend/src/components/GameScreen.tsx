import { useSimStore } from "../store/simStore";
import { DecisionModal } from "./DecisionModal";
import { GameOverModal } from "./GameOverModal";
import { GamePanel } from "./GamePanel";
import { GameTopBar } from "./GameTopBar";
import { NewsToast } from "./NewsToast";
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
        <WorldMap showModes />
        <GamePanel state={state} nation={nation} />
      </div>
      <OfflineBanner />
      <NewsToast />
      {state.gameOver ? (
        <GameOverModal gameOver={state.gameOver} state={state} />
      ) : (
        state.pendingDecision && (
          <DecisionModal decision={state.pendingDecision} />
        )
      )}
    </div>
  );
}
