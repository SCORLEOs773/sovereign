import { useEffect, useRef } from "react";
import { audio } from "../audio/audioEngine";
import { useSettingsStore } from "../store/settingsStore";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";

export function SoundEffects() {
  const screen = useUiStore((s) => s.screen);
  const atWar = useSimStore((s) => {
    const st = s.state;
    if (!st) return false;
    return st.wars.some(
      (w) =>
        w.attackers.includes(st.playerCountryId) ||
        w.defenders.includes(st.playerCountryId),
    );
  });
  const warCount = useSimStore((s) => s.state?.wars.length ?? 0);
  const eventKey = useSimStore((s) => {
    const events = s.state?.events;
    const last =
      events && events.length > 0 ? events[events.length - 1] : undefined;
    return last ? `${last.kind}|${last.tick}|${last.text}` : "";
  });
  const decisionKey = useSimStore((s) => {
    const d = s.state?.pendingDecision;
    return d ? `${d.templateId}@${d.tick}` : "";
  });
  const over = useSimStore((s) => s.state?.gameOver?.reason ?? "");

  // Browsers need a user gesture before audio can start
  useEffect(() => {
    const unlock = (): void => {
      audio.unlock();
      audio.startMusic();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Keep the engine in sync with the settings
  useEffect(() => useSettingsStore.subscribe(() => audio.applyVolumes()), []);

  // A soft click for every enabled button
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button || button.disabled) return;
      audio.play(
        button.classList.contains("btn-primary") ? "confirm" : "click",
      );
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // M toggles mute
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      )
        return;
      if (e.key.toLowerCase() === "m") {
        const settings = useSettingsStore.getState();
        settings.update({ muted: !settings.muted });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Music follows the situation
  useEffect(() => {
    audio.setMood(screen === "game" ? (atWar ? "tense" : "calm") : "menu");
  }, [screen, atWar]);

  // Sounds for things that happen in the game
  const previous = useRef({
    event: eventKey,
    wars: warCount,
    decision: decisionKey,
    over,
  });
  useEffect(() => {
    const p = previous.current;
    const overChanged = over !== "" && over !== p.over;
    const warAdded = warCount > p.wars;
    const decisionChanged = decisionKey !== "" && decisionKey !== p.decision;
    const eventChanged = eventKey !== "" && eventKey !== p.event;

    if (overChanged) audio.play(over === "retirement" ? "victory" : "defeat");
    else if (warAdded) audio.play("war");
    else if (decisionChanged) audio.play("decision");
    else if (eventChanged) {
      const kind = eventKey.split("|")[0];
      audio.play(
        kind === "good"
          ? "good"
          : kind === "warning"
            ? "warning"
            : kind === "crisis"
              ? "crisis"
              : "info",
      );
    }
    previous.current = {
      event: eventKey,
      wars: warCount,
      decision: decisionKey,
      over,
    };
  }, [eventKey, warCount, decisionKey, over]);

  return null;
}
