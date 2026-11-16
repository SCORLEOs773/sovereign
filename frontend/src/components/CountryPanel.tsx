import { useGameStore } from "../store/gameStore";
import {
  formatCompact,
  formatMoney,
  formatPercent,
  toCssColor,
} from "../format";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function CountryPanel() {
  const world = useGameStore((s) => s.world);
  const selectedId = useGameStore((s) => s.selectedCountryId);
  const selectCountry = useGameStore((s) => s.selectCountry);

  const country =
    selectedId === null
      ? undefined
      : world.countries.find((c) => c.id === selectedId);

  if (!country) {
    return (
      <aside className="side">
        <h3 className="side-heading">Nations of the world</h3>
        <p className="muted small">
          Click a country on the map, or pick one below.
        </p>
        <ul className="country-list">
          {world.countries.map((c) => (
            <li key={c.id}>
              <button
                className="country-item"
                onClick={() => selectCountry(c.id)}
              >
                <span
                  className="swatch"
                  style={{ background: toCssColor(c.color) }}
                />
                <span className="country-item-name">{c.name}</span>
                <span className="muted small">{c.region}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    );
  }

  return (
    <aside className="side">
      <button className="back" onClick={() => selectCountry(null)}>
        ← All nations
      </button>
      <div className="country-head">
        <span
          className="swatch large"
          style={{ background: toCssColor(country.color) }}
        />
        <div>
          <h2 className="country-name">{country.name}</h2>
          <div className="muted small">
            {country.region} · {country.archetype}
          </div>
        </div>
      </div>

      <h4 className="group">General</h4>
      <Stat label="Capital" value={country.capital.name} />
      <Stat label="Government" value={country.governmentType} />
      <Stat label="Territory" value={`${country.area} regions`} />

      <h4 className="group">Economy</h4>
      <Stat label="Population" value={formatCompact(country.population)} />
      <Stat label="GDP" value={formatMoney(country.gdp)} />
      <Stat label="GDP per capita" value={formatMoney(country.gdpPerCapita)} />
      <Stat
        label="National debt"
        value={`${formatPercent(country.debtPercentGdp)} of GDP`}
      />

      <h4 className="group">Politics</h4>
      <Stat
        label="Government approval"
        value={formatPercent(country.approval)}
      />
      <Stat label="Stability" value={formatPercent(country.stability)} />

      <h4 className="group">Military</h4>
      <Stat
        label="Army personnel"
        value={formatCompact(country.armyPersonnel)}
      />
    </aside>
  );
}
