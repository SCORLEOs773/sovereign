import { CountryPanel } from "./components/CountryPanel";
import { DeveloperCredit } from "./components/DeveloperCredit";
import { TopBar } from "./components/TopBar";
import { WorldMap } from "./components/WorldMap";

export function App() {
  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <WorldMap />
        <CountryPanel />
      </div>
      <DeveloperCredit />
    </div>
  );
}
