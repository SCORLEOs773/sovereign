import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";
import { setSpeed } from "./simClient";

/** Pause the game and start the guided tour. */
export function beginTutorial(): void {
  setSpeed(0);
  useUiStore.getState().setTutorialStep(0);
}

/** Close the tour, remember it was seen, and let time run. */
export function endTutorial(): void {
  useUiStore.getState().setTutorialStep(null);
  useSettingsStore.getState().update({ tutorialDone: true });
  setSpeed(1);
}
