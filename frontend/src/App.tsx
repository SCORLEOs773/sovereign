import { useEffect } from "react";
import { DeveloperCredit } from "./components/DeveloperCredit";
import { GameScreen } from "./components/GameScreen";
import { MainMenu } from "./components/MainMenu";
import { SetupScreen } from "./components/SetupScreen";
import { bootstrap } from "./sim/simClient";
import { useUiStore } from "./store/uiStore";

export function App() {
  const screen = useUiStore((s) => s.screen);

  useEffect(() => {
    void bootstrap();
  }, []);

  return (
    <>
      {screen === "menu" && <MainMenu />}
      {screen === "setup" && <SetupScreen />}
      {screen === "game" && <GameScreen />}
      <DeveloperCredit />
    </>
  );
}
