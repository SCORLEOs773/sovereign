import {
  IMPROVE_COST_GDP,
  MAX_ALLIANCES,
  MAX_TRADE_TREATIES,
  TREATY_LABELS,
  countTreaties,
  formatGameDate,
  onCooldown,
  proposalThreshold,
  type NationState,
  type SimState,
  type TreatyKind,
} from "@sovereign/shared";
import { formatMoney } from "../format";
import {
  cancelTreaty,
  improveRelations,
  proposeTreaty,
  respondProposal,
  setSanctions,
} from "../sim/simClient";
import { useGameStore } from "../store/gameStore";

const relationWord = (value: number): string =>
  value >= 60
    ? "Very friendly"
    : value >= 25
      ? "Friendly"
      : value > -25
        ? "Neutral"
        : value > -60
          ? "Cold"
          : "Hostile";

const relationClass = (value: number): string =>
  value >= 25 ? "good" : value <= -25 ? "bad" : "";

const TREATY_BUTTONS: { kind: TreatyKind; label: string }[] = [
  { kind: "trade", label: "Trade agreement" },
  { kind: "nonAggression", label: "Non-aggression pact" },
  { kind: "alliance", label: "Alliance" },
];

export function DiplomacyTab({ state }: { state: SimState }) {
  const selectedId = useGameStore((s) => s.selectedCountryId);
  const selectCountry = useGameStore((s) => s.selectCountry);

  const playerId = state.playerCountryId;
  const me = state.nations[playerId]!;
  const row = state.relations[playerId] ?? [];
  const others = state.nations
    .filter((n) => n.id !== playerId)
    .sort((a, b) => (row[b.id] ?? 0) - (row[a.id] ?? 0));
  const selected: NationState | undefined =
    selectedId !== null && selectedId !== playerId
      ? state.nations[selectedId]
      : undefined;

  const ties = (
    n: NationState,
  ): { label: string; red?: boolean; title: string }[] => {
    const result: { label: string; red?: boolean; title: string }[] = [];
    for (const t of state.treaties) {
      if (
        !(
          (t.a === playerId && t.b === n.id) ||
          (t.b === playerId && t.a === n.id)
        )
      )
        continue;
      if (t.kind === "trade")
        result.push({ label: "T", title: "Trade agreement" });
      if (t.kind === "nonAggression")
        result.push({ label: "P", title: "Non-aggression pact" });
      if (t.kind === "alliance") result.push({ label: "A", title: "Alliance" });
    }
    if (state.sanctions.some((s) => s.by === playerId && s.target === n.id)) {
      result.push({ label: "S", red: true, title: "You sanction them" });
    }
    if (state.sanctions.some((s) => s.by === n.id && s.target === playerId)) {
      result.push({ label: "S!", red: true, title: "They sanction you" });
    }
    return result;
  };

  const improveCost = me.gdp * IMPROVE_COST_GDP;

  return (
    <div>
      <h4 className="group">Inbox</h4>
      {state.proposals.length === 0 && (
        <p className="muted small">
          No offers right now. Friendly nations will write to you.
        </p>
      )}
      {state.proposals.map((p) => {
        const from = state.nations[p.from]!;
        return (
          <div key={p.id} className="inbox-item">
            <span>
              <strong>{from.name}</strong> proposes a {TREATY_LABELS[p.kind]}.
              <span className="muted small">
                {" "}
                Expires {formatGameDate(p.expires)}.
              </span>
            </span>
            <div className="btn-row">
              <button
                className="btn small"
                onClick={() => respondProposal(p.id, true)}
              >
                Accept
              </button>
              <button
                className="btn small"
                onClick={() => respondProposal(p.id, false)}
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}

      <h4 className="group">Capacity</h4>
      <p className="small">
        Trade agreements: {countTreaties(state, playerId, "trade")} /{" "}
        {MAX_TRADE_TREATIES} · Alliances:{" "}
        {countTreaties(state, playerId, "alliance")} / {MAX_ALLIANCES}
      </p>
      <p className="muted small">
        Trade deals and alliances boost growth. Sanctions hurt the target, and
        you slightly.
      </p>

      {selected ? (
        <>
          <h4 className="group">{selected.name}</h4>
          <p className="small">
            Relations:{" "}
            <span className={`rel ${relationClass(row[selected.id] ?? 0)}`}>
              {Math.round(row[selected.id] ?? 0)}
            </span>{" "}
            ({relationWord(row[selected.id] ?? 0)})
          </p>

          <div className="action-grid">
            <div className="action">
              <span>Diplomatic mission ({formatMoney(improveCost)})</span>
              <button
                className="btn small"
                disabled={
                  me.treasury < improveCost ||
                  onCooldown(state, `improve:${playerId}:${selected.id}`, 3)
                }
                onClick={() => improveRelations(selected.id)}
              >
                +10 relations
              </button>
            </div>

            {TREATY_BUTTONS.map(({ kind, label }) => {
              const existing = state.treaties.find(
                (t) =>
                  t.kind === kind &&
                  ((t.a === playerId && t.b === selected.id) ||
                    (t.b === playerId && t.a === selected.id)),
              );
              return (
                <div key={kind} className="action">
                  <span>
                    {label}{" "}
                    <span className="muted small">
                      (they want ≥ {proposalThreshold(selected, kind)})
                    </span>
                  </span>
                  {existing ? (
                    <button
                      className="btn small danger"
                      onClick={() => cancelTreaty(existing.id)}
                    >
                      Withdraw
                    </button>
                  ) : (
                    <button
                      className="btn small"
                      onClick={() => proposeTreaty(selected.id, kind)}
                    >
                      Propose
                    </button>
                  )}
                </div>
              );
            })}

            <div className="action">
              <span>Sanctions</span>
              {state.sanctions.some(
                (s) => s.by === playerId && s.target === selected.id,
              ) ? (
                <button
                  className="btn small"
                  onClick={() => setSanctions(selected.id, false)}
                >
                  Lift sanctions
                </button>
              ) : (
                <button
                  className="btn small danger"
                  onClick={() => setSanctions(selected.id, true)}
                >
                  Impose sanctions
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="muted small">
          Select a nation on the map or in the table below to open diplomacy
          options.
        </p>
      )}

      <h4 className="group">Relations</h4>
      <table className="table">
        <thead>
          <tr>
            <th>Nation</th>
            <th>Relations</th>
            <th>Ties</th>
          </tr>
        </thead>
        <tbody>
          {others.map((n) => {
            const value = row[n.id] ?? 0;
            return (
              <tr
                key={n.id}
                className={n.id === selectedId ? "row-selected" : ""}
                onClick={() => selectCountry(n.id)}
              >
                <td>{n.name}</td>
                <td className={`rel ${relationClass(value)}`}>
                  {Math.round(value)}{" "}
                  <span className="muted small">{relationWord(value)}</span>
                </td>
                <td>
                  {ties(n).map((t, i) => (
                    <span
                      key={i}
                      className={`tag ${t.red ? "red" : ""}`}
                      title={t.title}
                    >
                      {t.label}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
