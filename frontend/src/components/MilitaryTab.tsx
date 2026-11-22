import {
  POLICY_LIMITS,
  canDeclareWar,
  militaryPower,
  sideOf,
  warOutlook,
  type NationState,
  type SimState,
  type War,
} from "@sovereign/shared";
import { formatCompact } from "../format";
import {
  declareWar,
  demandSurrender,
  proposePeace,
  setPolicy,
} from "../sim/simClient";
import { useGameStore } from "../store/gameStore";
import { LineChart } from "./LineChart";
import { PolicySlider } from "./PolicySlider";
import { Stat } from "./Stat";

function WarCard({ war, state }: { war: War; state: SimState }) {
  const playerId = state.playerCountryId;
  const side = sideOf(war, playerId);
  const name = (id: number): string => state.nations[id]?.name ?? "?";

  // Show the war from the player's point of view, or the attackers' if the player is not involved
  const mine = side ?? "attackers";
  const myScore = mine === "attackers" ? war.score : -war.score;
  const myLeader = mine === "attackers" ? war.attackers[0]! : war.defenders[0]!;
  const foeLeader =
    mine === "attackers" ? war.defenders[0]! : war.attackers[0]!;
  const foe = state.nations[foeLeader]!;
  const me = state.nations[myLeader]!;

  return (
    <div className={`war-card ${side ? "" : "foreign"}`}>
      <div className="war-title">
        {name(war.attackers[0]!)} vs {name(war.defenders[0]!)}
      </div>
      <div className="muted small">
        {war.months} months · {war.attackers.length} vs {war.defenders.length}{" "}
        nations
      </div>

      <div className="tug">
        <div
          className="tug-fill"
          style={{ width: `${(myScore + 100) / 2}%` }}
        />
      </div>
      <div className="tug-labels">
        <span>{me.name}</span>
        <span>War score {Math.round(myScore)}</span>
        <span>{foe.name}</span>
      </div>

      {war.occupations.map((o, i) => (
        <div key={i} className="small">
          {name(o.holder)} holds {Math.round(o.fraction * 100)}% of{" "}
          {name(o.victim)}
        </div>
      ))}

      {side && (
        <>
          <div className="small muted">
            Your weariness {state.nations[playerId]!.warWeariness.toFixed(0)}% ·{" "}
            {foe.name} {foe.warWeariness.toFixed(0)}%
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn small" onClick={() => proposePeace(war.id)}>
              Propose ceasefire
            </button>
            <button
              className="btn small"
              disabled={myScore < 50}
              onClick={() => demandSurrender(war.id)}
            >
              Demand surrender
            </button>
          </div>
          {myScore < 50 && (
            <div className="muted small">
              Surrender can be demanded from a war score of 50.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function MilitaryTab({
  state,
  nation,
}: {
  state: SimState;
  nation: NationState;
}) {
  const selectedId = useGameStore((s) => s.selectedCountryId);
  const selectCountry = useGameStore((s) => s.selectCountry);

  const playerId = state.playerCountryId;
  const ranking = [...state.nations].sort(
    (a, b) => militaryPower(b) - militaryPower(a),
  );
  const rank = ranking.findIndex((n) => n.id === playerId) + 1;
  const maxPower = Math.max(1, militaryPower(ranking[0]!));
  const mine = militaryPower(nation);

  const myWars = state.wars.filter((w) => sideOf(w, playerId) !== null);
  const otherWars = state.wars.filter((w) => sideOf(w, playerId) === null);
  const selected =
    selectedId !== null && selectedId !== playerId
      ? state.nations[selectedId]
      : undefined;

  const atWar = (id: number): boolean =>
    state.wars.some((w) => sideOf(w, id) !== null);

  const renderTarget = (target: NationState) => {
    const check = canDeclareWar(state, playerId, target.id);
    const outlook = warOutlook(state, playerId, target.id);
    const verdict =
      outlook.ratio >= 1.5
        ? "You hold a clear edge."
        : outlook.ratio >= 1
          ? "Roughly even, slightly in your favour."
          : "They are stronger. This would be risky.";

    return (
      <>
        <h4 className="group">{target.name}</h4>
        <Stat
          label="Their military power"
          value={formatCompact(militaryPower(target))}
        />
        <Stat
          label="Your power vs theirs (with defender bonus)"
          value={`${outlook.ratio.toFixed(2)} : 1`}
        />
        <p className="small muted">{verdict}</p>
        {outlook.defenderAllies.length > 0 && (
          <p className="small muted">
            Allies who may join them:{" "}
            {outlook.defenderAllies
              .map((id) => state.nations[id]!.name)
              .join(", ")}
            .
          </p>
        )}
        <button
          className="btn danger"
          disabled={!check.ok}
          onClick={() => {
            if (
              window.confirm(
                `Declare war on ${target.name}? War costs money, lives and public support.`,
              )
            ) {
              declareWar(target.id);
            }
          }}
        >
          Declare war on {target.name}
        </button>
        {!check.ok && <p className="small muted">{check.message}</p>}
      </>
    );
  };

  return (
    <div>
      <h4 className="group">Armed forces</h4>
      <Stat label="Personnel" value={formatCompact(nation.army)} />
      <Stat
        label="Equipment quality"
        value={`${nation.equipment.toFixed(0)} / 100`}
      />
      <Stat
        label="Military power"
        value={`${formatCompact(mine)} (rank ${rank} of ${state.nations.length})`}
      />
      <Stat
        label="War weariness"
        value={`${nation.warWeariness.toFixed(0)}%`}
      />

      <div style={{ marginTop: 10 }}>
        <PolicySlider
          label="Defence spending (share of GDP)"
          value={nation.policy.spending.defence}
          baseline={nation.baseline.spending.defence}
          min={POLICY_LIMITS.spending.min}
          max={POLICY_LIMITS.spending.max}
          step={0.0025}
          onChange={(v) => setPolicy({ spending: { defence: v } })}
        />
      </div>
      <p className="muted small">
        Money per soldier lifts equipment quality, and spending relative to your
        starting level changes recruitment. Both change slowly, over months.
        Infrastructure keeps armies supplied.
      </p>

      <h4 className="group">Your wars</h4>
      {myWars.length === 0 && <p className="muted small">You are at peace.</p>}
      {myWars.map((w) => (
        <WarCard key={w.id} war={w} state={state} />
      ))}

      {otherWars.length > 0 && (
        <>
          <h4 className="group">Wars elsewhere</h4>
          {otherWars.map((w) => (
            <WarCard key={w.id} war={w} state={state} />
          ))}
        </>
      )}

      {selected ? (
        renderTarget(selected)
      ) : (
        <p className="muted small">
          Select a nation on the map to compare forces and see whether you can
          declare war.
        </p>
      )}

      <h4 className="group">Military power ranking</h4>
      <div className="power-list">
        {ranking.slice(0, 10).map((n) => (
          <div
            key={n.id}
            className={`power-row ${n.id === playerId ? "me" : ""}`}
            onClick={() => selectCountry(n.id)}
          >
            <span className="power-name">
              {n.name}
              {atWar(n.id) ? " ⚔" : ""}
            </span>
            <div className="power-bar">
              <div
                className="power-fill"
                style={{ width: `${(militaryPower(n) / maxPower) * 100}%` }}
              />
            </div>
            <span className="power-val">{formatCompact(militaryPower(n))}</span>
          </div>
        ))}
      </div>

      <h4 className="group">Your military power over time</h4>
      <LineChart
        title="Power"
        values={state.history.power}
        format={formatCompact}
        color="#e0645c"
      />
    </div>
  );
}
