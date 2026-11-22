import {
  computeBudget,
  computeScore,
  formatGameDate,
  getObjectives,
  hasElections,
  nextElectionYear,
  type NationState,
  type SimState,
} from "@sovereign/shared";
import { formatRatio, toCssColor } from "../format";
import { useGameStore } from "../store/gameStore";
import { Stat } from "./Stat";

export function OverviewTab({
  state,
  nation,
}: {
  state: SimState;
  nation: NationState;
}) {
  const country = useGameStore((s) =>
    s.world.countries.find((c) => c.id === nation.id),
  );
  const electoral = hasElections(nation.governmentType);
  const budget = computeBudget(nation);
  const balance = budget.balance / nation.gdp;
  const latest = [...state.events].reverse().slice(0, 5);
  const objectives = getObjectives(state);

  return (
    <div>
      <div className="country-head">
        <span
          className="swatch large"
          style={{ background: country ? toCssColor(country.color) : "#888" }}
        />
        <div>
          <h2 className="country-name">{nation.name}</h2>
          <div className="muted small">{country?.archetype}</div>
        </div>
      </div>

      <h4 className="group">Legacy score</h4>
      <div className="score">{computeScore(state)}</div>

      <h4 className="group">Government</h4>
      <Stat label="System" value={nation.governmentType} />
      <Stat
        label="Next election"
        value={
          electoral
            ? `January ${nextElectionYear(state.tick)}`
            : "None in this system"
        }
      />
      <Stat label="Term ends" value="January 2052" />

      <h4 className="group">Objectives</h4>
      {objectives.map((o) => (
        <div key={o.id} className="obj">
          <div className="obj-head">
            <span>{o.title}</span>
            <span className={o.done ? "ok" : "muted"}>
              {o.done ? "Done" : o.status}
            </span>
          </div>
          <div className="bar">
            <div
              className={`bar-fill ${o.done ? "done" : ""}`}
              style={{ width: `${Math.round(o.progress * 100)}%` }}
            />
          </div>
          <div className="muted small">{o.description}</div>
        </div>
      ))}

      <h4 className="group">Indicators</h4>
      <Stat label="Approval" value={`${nation.approval.toFixed(0)}%`} />
      <Stat label="Stability" value={`${nation.stability.toFixed(0)}%`} />
      <Stat label="GDP growth" value={formatRatio(nation.growth)} />
      <Stat label="Inflation" value={formatRatio(nation.inflation)} />
      <Stat label="Unemployment" value={formatRatio(nation.unemployment)} />
      <Stat
        label="National debt"
        value={`${formatRatio(nation.debt / nation.gdp, 0)} of GDP`}
      />
      <Stat
        label="Budget balance"
        value={`${balance >= 0 ? "+" : ""}${formatRatio(balance)} of GDP`}
      />
      <Stat
        label="Trade boost"
        value={`+${formatRatio(nation.tradeBonus)} growth`}
      />
      {nation.sanctionPenalty > 0 && (
        <Stat
          label="Sanctions drag"
          value={`-${formatRatio(nation.sanctionPenalty)} growth`}
        />
      )}

      <h4 className="group">Latest news</h4>
      <ul className="event-list">
        {latest.map((e, i) => (
          <li key={`${e.tick}-${i}`} className={`event ${e.kind}`}>
            <span className="event-date">{formatGameDate(e.tick)}</span>
            <span>{e.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
