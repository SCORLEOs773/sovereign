import { useEffect } from "react";
import { CountryPanel } from "./components/CountryPanel";
import { DeveloperCredit } from "./components/DeveloperCredit";
import { OfflineBanner } from "./components/OfflineBanner";
import { SimDebug } from "./components/SimDebug";
import { TopBar } from "./components/TopBar";
import { WorldMap } from "./components/WorldMap";
import { startSimulation } from "./sim/simClient";

export function App() {
  useEffect(() => {
    void startSimulation();
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <WorldMap />
        <CountryPanel />
      </div>
      <OfflineBanner />
      <SimDebug />
      <DeveloperCredit />
    </div>
  );
}
