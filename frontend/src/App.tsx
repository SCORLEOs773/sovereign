import { useEffect } from "react";
import { Briefing } from "./components/Briefing";
import { DeveloperCredit } from "./components/DeveloperCredit";
import { GameScreen } from "./components/GameScreen";
import { Intro } from "./components/Intro";
import { MainMenu } from "./components/MainMenu";
import { SetupScreen } from "./components/SetupScreen";
import { SettingsModal } from "./components/SettingsModal";
import { SoundEffects } from "./components/SoundEffects";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { bootstrap } from "./sim/simClient";
import { useUiStore } from "./store/uiStore";

export function App() {
  const screen = useUiStore((s) => s.screen);
  const settingsOpen = useUiStore((s) => s.settingsOpen);

  useEffect(() => {
    void bootstrap();
  }, []);

  return (
    <>
      {screen === "menu" && <MainMenu />}
      {screen === "setup" && <SetupScreen />}
      {screen === "game" && (
        <>
          <GameScreen />
          <Briefing />
          <TutorialOverlay />
        </>
      )}
      {settingsOpen && <SettingsModal />}
      <Intro />
      <SoundEffects />
      <DeveloperCredit />
    </>
  );
}
