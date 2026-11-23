import {
  SIM_CONFIG,
  getObjectives,
  hasElections,
  militaryPower,
  type NationState,
  type SimState,
} from "@sovereign/shared";
import { setSpeed } from "../sim/simClient";
import { beginTutorial } from "../sim/tutorial";
import { useGameStore } from "../store/gameStore";
import { useSettingsStore } from "../store/settingsStore";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";

function challenges(state: SimState, n: NationState): string[] {
  const list: string[] = [];
  const firstElection = SIM_CONFIG.startYear + SIM_CONFIG.electionIntervalYears;

  if (hasElections(n.governmentType)) {
    if (n.approval < 50) {
      list.push(
        `Approval is ${n.approval.toFixed(0)}%. You need about 50% before the first election in January ${firstElection}.`,
      );
    } else {
      list.push(
        `Approval is a comfortable ${n.approval.toFixed(0)}%, but it will not stay that way on its own.`,
      );
    }
  } else {
    list.push(
      "This system holds no elections. Your survival depends on keeping stability above 10%.",
    );
  }
  if (n.debt / n.gdp > 1)
    list.push(
      `Debt stands at ${((n.debt / n.gdp) * 100).toFixed(0)}% of GDP, so borrowing is costly.`,
    );
  if (n.inflation > 0.045)
    list.push(`Inflation is high at ${(n.inflation * 100).toFixed(1)}%.`);
  if (n.unemployment > 0.08)
    list.push(`Unemployment is ${(n.unemployment * 100).toFixed(1)}%.`);

  const neighbours = state.adjacency[n.id] ?? [];
  if (neighbours.length === 0) {
    list.push(
      "An island nation: trade matters, and your neighbours are across the sea.",
    );
  } else {
    const strongest = neighbours
      .map((id) => state.nations[id]!)
      .sort((a, b) => militaryPower(b) - militaryPower(a))[0]!;
    if (militaryPower(strongest) > militaryPower(n) * 1.3) {
      list.push(`${strongest.name} next door is the stronger military power.`);
    }
  }
  if (list.length === 1)
    list.push("A fairly balanced start. Your choices will define this nation.");
  return list;
}

export function Briefing() {
  const open = useUiStore((s) => s.briefingOpen);
  const setOpen = useUiStore((s) => s.setBriefingOpen);
  const state = useSimStore((s) => s.state);
  const country = useGameStore((s) =>
    state
      ? s.world.countries.find((c) => c.id === state.playerCountryId)
      : undefined,
  );
  const tutorialDone = useSettingsStore((s) => s.tutorialDone);

  if (!open || !state) return null;
  const nation = state.nations[state.playerCountryId]!;
  const objectives = getObjectives(state);

  const takeOffice = (): void => {
    setOpen(false);
    setSpeed(1);
  };
  const takeOfficeWithTour = (): void => {
    setOpen(false);
    beginTutorial();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal wide">
        <div className="kicker">
          Inauguration · January {SIM_CONFIG.startYear}
        </div>
        <h2>{nation.name}</h2>
        <p className="muted">
          {nation.governmentType} · {country?.archetype}
        </p>

        <div className="brief-grid">
          <div>
            <strong>Your situation</strong>
            <ul className="brief-list">
              {challenges(state, nation).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Your objectives</strong>
            <ul className="brief-list">
              {objectives.map((o) => (
                <li key={o.id}>
                  {o.title}: <span className="muted">{o.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="muted small">
          Your term runs until January {SIM_CONFIG.campaignEndYear}. The game is
          paused until you take office.
        </p>

        <div className="modal-actions">
          {tutorialDone ? (
            <>
              <button className="btn-primary" onClick={takeOffice}>
                Take office
              </button>
              <button className="btn" onClick={takeOfficeWithTour}>
                Take office with guided tour
              </button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={takeOfficeWithTour}>
                Take office with guided tour
              </button>
              <button className="btn" onClick={takeOffice}>
                Skip the tour
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
