import {
  computeScore,
  formatGameDate,
  getObjectives,
  type GameOver,
  type SimState,
} from "@sovereign/shared";
import { backToMenu } from "../sim/simClient";

const COPY: Record<GameOver["reason"], { title: string; text: string }> = {
  election: {
    title: "Defeated at the polls",
    text: "Voters rejected your leadership. Your time in office is over.",
  },
  collapse: {
    title: "Government collapsed",
    text: "Unrest overwhelmed the state and your government fell.",
  },
  retirement: {
    title: "Your term ends",
    text: "After twenty years you leave office. History will judge your legacy.",
  },
  conquest: {
    title: "Your country has fallen",
    text: "Enemy armies overran the nation. Your government is no more.",
  },
};

export function GameOverModal({
  gameOver,
  state,
}: {
  gameOver: GameOver;
  state: SimState;
}) {
  const copy = COPY[gameOver.reason];
  const objectives = getObjectives(state);
  const done = objectives.filter((o) => o.done).length;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{copy.title}</h2>
        <p className="muted">{formatGameDate(gameOver.tick)}</p>
        <p>{copy.text}</p>
        <div className="kicker">Legacy score</div>
        <div className="score">{computeScore(state)}</div>
        <p className="muted small">
          {done} of {objectives.length} objectives completed
        </p>
        <button className="btn-primary full" onClick={() => void backToMenu()}>
          Back to main menu
        </button>
      </div>
    </div>
  );
}
