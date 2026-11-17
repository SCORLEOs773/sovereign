import {
  computeBudget,
  hasElections,
  nextElectionYear,
  type NationState,
  type SimState,
} from "@sovereign/shared";
import { formatRatio } from "../format";
import { useGameStore } from "../store/gameStore";
import { formatGameDate } from "@sovereign/shared";
import { Stat } from "./Stat";
import { toCssColor } from "../format";

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

  return (
    <div>
      <div className="country-head">
        <span
          className="swatch large"
          style={{ background: country ? toCssColor(country.color) : "#888" }}
        />
        <div>
          <h2 className="country-name">{country?.name}</h2>
          <div className="muted small">{country?.archetype}</div>
        </div>
      </div>

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

      <h4 className="group">Your goal</h4>
      <p className="small">
        {electoral
          ? "Stay in power. Elections are held every four years and you need roughly 50% approval or better on election day. If stability stays under 10% for three months, your government collapses."
          : "Stay in power. This system holds no elections, but if stability stays under 10% for three months, your government collapses."}
      </p>

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
