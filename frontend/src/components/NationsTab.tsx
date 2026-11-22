import { type Country, type SimState } from "@sovereign/shared";
import {
  formatCompact,
  formatMoney,
  formatPercent,
  formatRatio,
  toCssColor,
} from "../format";
import { useGameStore } from "../store/gameStore";
import { Stat } from "./Stat";

export function NationsTab({ state }: { state: SimState }) {
  const world = useGameStore((s) => s.world);
  const selectedId = useGameStore((s) => s.selectedCountryId);
  const selectCountry = useGameStore((s) => s.selectCountry);

  const countries = new Map<number, Country>(
    world.countries.map((c) => [c.id, c] as [number, Country]),
  );
  const rows = [...state.nations].sort((a, b) => b.gdp - a.gdp);
  const selected =
    selectedId === null
      ? undefined
      : state.nations.find((n) => n.id === selectedId);
  const selectedCountry = selected ? countries.get(selected.id) : undefined;

  return (
    <div>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Nation</th>
            <th>GDP</th>
            <th>Growth</th>
            <th>Approval</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n, i) => {
            const c = countries.get(n.id);
            return (
              <tr
                key={n.id}
                className={`${n.id === state.playerCountryId ? "row-player" : ""} ${n.id === selectedId ? "row-selected" : ""}`}
                onClick={() => selectCountry(n.id)}
              >
                <td>{i + 1}</td>
                <td>
                  <span
                    className="swatch"
                    style={{ background: c ? toCssColor(c.color) : "#888" }}
                  />{" "}
                  {c?.name}
                </td>
                <td>{formatMoney(n.gdp)}</td>
                <td>{formatRatio(n.growth)}</td>
                <td>{formatPercent(n.approval)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected && selectedCountry && (
        <>
          <h4 className="group">
            {selectedCountry.name}
            {selected.id === state.playerCountryId ? " (you)" : ""}
          </h4>
          <Stat label="Government" value={selected.governmentType} />
          <Stat label="Population" value={formatCompact(selected.population)} />
          <Stat
            label="GDP per capita"
            value={formatMoney(selected.gdp / selected.population)}
          />
          <Stat label="Inflation" value={formatRatio(selected.inflation)} />
          <Stat
            label="Unemployment"
            value={formatRatio(selected.unemployment)}
          />
          <Stat
            label="Debt"
            value={`${formatRatio(selected.debt / selected.gdp, 0)} of GDP`}
          />
          <Stat label="Stability" value={formatPercent(selected.stability)} />
          <Stat
            label="Income tax"
            value={formatRatio(selected.policy.incomeTax)}
          />
          <Stat
            label="Corporate tax"
            value={formatRatio(selected.policy.corporateTax)}
          />
          <Stat
            label="Interest rate"
            value={formatRatio(selected.policy.interestRate)}
          />
          <Stat
            label="Defence spending"
            value={`${formatRatio(selected.policy.spending.defence)} of GDP`}
          />
        </>
      )}
    </div>
  );
}
