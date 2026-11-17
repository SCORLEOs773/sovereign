import { useState } from "react";
import type { NationState, SimState } from "@sovereign/shared";
import { EconomyTab } from "./EconomyTab";
import { EventsTab } from "./EventsTab";
import { NationsTab } from "./NationsTab";
import { OverviewTab } from "./OverviewTab";

type TabId = "overview" | "economy" | "nations" | "events";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "economy", label: "Economy" },
  { id: "nations", label: "Nations" },
  { id: "events", label: "News" },
];

export function GamePanel({
  state,
  nation,
}: {
  state: SimState;
  nation: NationState;
}) {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <aside className="side wide">
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <OverviewTab state={state} nation={nation} />}
      {tab === "economy" && <EconomyTab state={state} nation={nation} />}
      {tab === "nations" && <NationsTab state={state} />}
      {tab === "events" && <EventsTab state={state} />}
    </aside>
  );
}
