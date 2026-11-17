import { formatGameDate, type GameOver } from "@sovereign/shared";
import { backToMenu } from "../sim/simClient";

export function GameOverModal({ gameOver }: { gameOver: GameOver }) {
  const lost = gameOver.reason === "election";
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{lost ? "Defeated at the polls" : "Government collapsed"}</h2>
        <p className="muted">{formatGameDate(gameOver.tick)}</p>
        <p>
          {lost
            ? "Voters rejected your leadership. Your time in office is over."
            : "Unrest overwhelmed the state and your government fell."}
        </p>
        <button className="btn-primary full" onClick={() => void backToMenu()}>
          Back to main menu
        </button>
      </div>
    </div>
  );
}
