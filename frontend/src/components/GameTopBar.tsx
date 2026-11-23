import { GAME_NAME, type NationState, type SimState } from "@sovereign/shared";
import { formatCompact, formatMoney, formatPercent } from "../format";
import { backToMenu } from "../sim/simClient";
import { useGameStore } from "../store/gameStore";
import { useUiStore } from "../store/uiStore";
import { ClockControls } from "./ClockControls";

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="chip">
      <span className="chip-label">{label}</span>
      <span className={`chip-value ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

const tone = (value: number, good: number, bad: number): string =>
  value >= good ? "ok" : value < bad ? "bad" : "";

export function GameTopBar({
  nation,
  state,
}: {
  nation: NationState;
  state: SimState;
}) {
  const name = useGameStore(
    (s) => s.world.countries.find((c) => c.id === nation.id)?.name ?? "",
  );
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const atWar = state.wars.some(
    (w) => w.attackers.includes(nation.id) || w.defenders.includes(nation.id),
  );

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-title">{GAME_NAME}</span>
        <span className="player-name">{name}</span>
      </div>
      {atWar && <span className="war-badge">⚔ AT WAR</span>}
      <div className="spacer" />
      <ClockControls />
      <div className="spacer" />
      <div className="chips">
        <Chip label="Treasury" value={formatMoney(nation.treasury)} />
        <Chip label="GDP" value={formatMoney(nation.gdp)} />
        <Chip label="Population" value={formatCompact(nation.population)} />
        <Chip
          label="Approval"
          value={formatPercent(nation.approval)}
          tone={tone(nation.approval, 55, 40)}
        />
        <Chip
          label="Stability"
          value={formatPercent(nation.stability)}
          tone={tone(nation.stability, 60, 35)}
        />
      </div>
      <button
        className="btn"
        onClick={() => setSettingsOpen(true)}
        aria-label="Settings"
        title="Settings"
      >
        ⚙
      </button>
      <button className="btn" onClick={() => void backToMenu()}>
        Menu
      </button>
    </header>
  );
}
