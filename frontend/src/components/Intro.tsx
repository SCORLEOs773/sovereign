import { useEffect, useState } from "react";
import { GAME_NAME, GAME_SUBTITLE, GAME_TAGLINE } from "@sovereign/shared";
import { audio } from "../audio/audioEngine";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";
import { WorldBackdrop } from "./WorldBackdrop";

const LINES = [
  "2032.",
  "Twenty nations share one fragile world.",
  "Economies rise. Alliances break. Armies march.",
  "And you hold the ledger, the treaty pen, and the final word.",
];
const LINE_MS = 3200;

export function Intro() {
  const open = useUiStore((s) => s.introOpen);
  const setOpen = useUiStore((s) => s.setIntroOpen);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);

  // Reset every time the intro opens. If audio is already unlocked we can skip the splash.
  useEffect(() => {
    if (open) {
      setStarted(audio.isUnlocked());
      setIndex(0);
    }
  }, [open]);

  // The timed sequence
  useEffect(() => {
    if (!open || !started) return;
    audio.play("intro");
    const timers: number[] = [];
    for (let i = 0; i <= LINES.length; i++) {
      timers.push(
        window.setTimeout(
          () => setIndex((prev) => Math.max(prev, i)),
          i * LINE_MS,
        ),
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [open, started]);

  const finish = (): void => {
    setOpen(false);
    useSettingsStore.getState().update({ introSeen: true });
  };

  const advance = (): void => {
    if (!started) {
      audio.unlock();
      audio.startMusic();
      setStarted(true);
    } else if (index < LINES.length) {
      setIndex(LINES.length);
    } else {
      finish();
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") finish();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, started, index]);

  if (!open) return null;

  return (
    <div className="intro" onClick={advance}>
      <WorldBackdrop />
      <div className="intro-vignette" />
      <button
        className="btn intro-skip"
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
      >
        Skip
      </button>

      <div className="intro-content">
        {!started && (
          <>
            <h1 className="intro-title">{GAME_NAME}</h1>
            <p className="intro-hint">Click to begin · sound on</p>
          </>
        )}
        {started && index < LINES.length && (
          <p key={index} className="intro-line">
            {LINES[index]}
          </p>
        )}
        {started && index >= LINES.length && (
          <>
            <h1 className="intro-title">{GAME_NAME}</h1>
            <h2 className="menu-sub">{GAME_SUBTITLE}</h2>
            <p className="menu-tag">{GAME_TAGLINE}</p>
            <p className="intro-hint">Click to continue</p>
          </>
        )}
      </div>
    </div>
  );
}
