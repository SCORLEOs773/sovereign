import type { PendingDecision } from "@sovereign/shared";
import { resolveDecision } from "../sim/simClient";

export function DecisionModal({ decision }: { decision: PendingDecision }) {
  return (
    <div className="modal-backdrop">
      <div className="modal decision">
        <div className="kicker">Decision required</div>
        <h2>{decision.title}</h2>
        <p>{decision.text}</p>
        <div className="options">
          {decision.options.map((o) => (
            <button
              key={o.id}
              className="option"
              onClick={() => resolveDecision(o.id)}
            >
              <strong>{o.label}</strong>
              <span className="muted small">{o.detail}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
