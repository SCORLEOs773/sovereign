import { useEffect } from "react";
import { audio } from "../audio/audioEngine";
import { beginTutorial } from "../sim/tutorial";
import { useSettingsStore } from "../store/settingsStore";
import { useSimStore } from "../store/simStore";
import { useUiStore } from "../store/uiStore";

function VolumeRow({
  label,
  value,
  onChange,
  onRelease,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onRelease?: () => void;
}) {
  return (
    <label className="slider-row">
      <div className="slider-head">
        <span>{label}</span>
        <span className="slider-value">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onRelease}
      />
    </label>
  );
}

export function SettingsModal() {
  const settings = useSettingsStore();
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const setIntroOpen = useUiStore((s) => s.setIntroOpen);
  const inGame = useUiStore((s) => s.screen === "game");
  const hasGame = useSimStore((s) => s.state !== null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  return (
    <div className="modal-backdrop top" onClick={() => setOpen(false)}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => settings.update({ muted: e.target.checked })}
          />
          Mute all sound (key M)
        </label>

        <VolumeRow
          label="Master volume"
          value={settings.master}
          onChange={(v) => settings.update({ master: v })}
        />
        <VolumeRow
          label="Music"
          value={settings.music}
          onChange={(v) => settings.update({ music: v })}
        />
        <VolumeRow
          label="Sound effects"
          value={settings.sfx}
          onChange={(v) => settings.update({ sfx: v })}
          onRelease={() => audio.play("good")}
        />

        <div className="modal-actions">
          <button
            className="btn"
            disabled={!inGame || !hasGame}
            onClick={() => {
              setOpen(false);
              beginTutorial();
            }}
          >
            Replay guided tour
          </button>
          <button
            className="btn"
            onClick={() => {
              setOpen(false);
              setIntroOpen(true);
            }}
          >
            Watch intro
          </button>
          <button className="btn-primary" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>

        <p className="muted small" style={{ marginTop: 14 }}>
          Keys: Space pauses · 1 to 4 set speed · M mutes · Esc deselects or
          closes
        </p>
        <p className="settings-foot">
          Sovereign: Age of Nations · developed by Sukhad Sharma
        </p>
      </div>
    </div>
  );
}
