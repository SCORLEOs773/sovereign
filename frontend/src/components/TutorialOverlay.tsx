import { useEffect, useState, type CSSProperties } from "react";
import { endTutorial } from "../sim/tutorial";
import { useUiStore } from "../store/uiStore";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

type Placement = "below" | "left" | "inside" | "center";

interface Step {
  title: string;
  text: string;
  placement: Placement;
  /** CSS selector of the element to spotlight */
  target?: string;
  /** Index of the side-panel tab to open first */
  tab?: number;
}

const STEPS: Step[] = [
  {
    title: "Welcome, Leader",
    text: "You now govern this nation in real time. This short tour covers the essentials. The game stays paused while you read.",
    placement: "center",
  },
  {
    title: "Time never stops",
    text: "The clock runs continuously. Press Space to pause, or keys 1 to 4 for 1x, 2x, 5x and 10x speed. Crises pause the clock for you automatically.",
    target: ".clock",
    placement: "below",
  },
  {
    title: "Your vital signs",
    text: "Treasury, GDP, population, approval and stability. Elections need roughly 50% approval. If stability stays under 10% for three months, your government collapses.",
    target: ".chips",
    placement: "below",
  },
  {
    title: "The world map",
    text: "Scroll to zoom, drag to pan and click any country to inspect it. Occupied land changes colour in wartime, and pulsing red dots mark battles.",
    target: ".map-area",
    placement: "inside",
  },
  {
    title: "Map modes",
    text: "Switch between Political, Relations, Economy and Military views to read the world at a glance.",
    target: ".map-modes",
    placement: "below",
  },
  {
    title: "Overview",
    text: "Your legacy score and objectives live here, along with your latest news. Your term ends in January 2052.",
    target: ".side",
    placement: "left",
    tab: 0,
  },
  {
    title: "Economy",
    text: "Move the sliders to set taxes, interest rates and spending. The budget projection updates instantly, but growth, inflation and approval respond over months.",
    target: ".side",
    placement: "left",
    tab: 1,
  },
  {
    title: "Diplomacy",
    text: "Select a nation on the map to improve relations, sign trade agreements, forge alliances or impose sanctions. AI offers arrive in your inbox.",
    target: ".side",
    placement: "left",
    tab: 2,
  },
  {
    title: "Military",
    text: "Defence spending builds your army slowly. War is costly: it drains the treasury, slows growth and wears down public support. Think before you declare one.",
    target: ".side",
    placement: "left",
    tab: 3,
  },
  {
    title: "You are ready",
    text: "Crises will land on your desk and ask for a decision. Press Start, then try key 4 to run at 10x. Your first election is January 2036. Good luck.",
    placement: "center",
    tab: 0,
  },
];

const CARD_WIDTH = 340;
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function cardStyle(box: Box | null, placement: Placement): CSSProperties {
  const margin = 14;
  if (!box || placement === "center") {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  const maxTop = Math.max(margin, window.innerHeight - 280);
  if (placement === "left") {
    return {
      left: Math.max(margin, box.left - CARD_WIDTH - margin),
      top: clamp(box.top + 24, margin, maxTop),
    };
  }
  if (placement === "inside") {
    return {
      left: box.left + 40,
      top: clamp(box.top + box.height / 2 - 120, margin, maxTop),
    };
  }
  return {
    left: clamp(box.left, margin, window.innerWidth - CARD_WIDTH - margin),
    top: clamp(box.top + box.height + margin, margin, maxTop),
  };
}

export function TutorialOverlay() {
  const step = useUiStore((s) => s.tutorialStep);
  const setStep = useUiStore((s) => s.setTutorialStep);
  const [box, setBox] = useState<Box | null>(null);
  const current = step === null ? undefined : STEPS[step];

  // Open the right tab for this step
  useEffect(() => {
    if (!current || current.tab === undefined) return;
    document
      .querySelectorAll<HTMLButtonElement>(".tabs .tab")
      [current.tab]?.click();
  }, [current]);

  // Follow the spotlight target as the layout changes
  useEffect(() => {
    const selector = current?.target;
    if (!selector) {
      setBox(null);
      return;
    }
    const update = (): void => {
      const el = document.querySelector(selector);
      if (!el) {
        setBox(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setBox((prev) =>
        prev &&
        prev.left === r.left &&
        prev.top === r.top &&
        prev.width === r.width &&
        prev.height === r.height
          ? prev
          : { left: r.left, top: r.top, width: r.width, height: r.height },
      );
    };
    update();
    const timer = window.setInterval(update, 250);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", update);
    };
  }, [current]);

  const finish = (): void => {
    document.querySelectorAll<HTMLButtonElement>(".tabs .tab")[0]?.click();
    endTutorial();
  };

  // Keyboard control
  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (step >= STEPS.length - 1) finish();
        else setStep(step + 1);
      } else if (e.key === "ArrowLeft" && step > 0) setStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (step === null || !current) return null;
  const last = step === STEPS.length - 1;

  return (
    <div className="tour">
      {box ? (
        <div
          className="tour-spot"
          style={{
            left: box.left - 6,
            top: box.top - 6,
            width: box.width + 12,
            height: box.height + 12,
          }}
        />
      ) : (
        <div className="tour-dim" />
      )}

      <div className="tour-card" style={cardStyle(box, current.placement)}>
        <div className="kicker">
          Guide · {step + 1} / {STEPS.length}
        </div>
        <h3>{current.title}</h3>
        <p>{current.text}</p>
        <div className="btn-row">
          {step > 0 && (
            <button className="btn small" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {!last && (
            <button className="btn small" onClick={finish}>
              Skip tour
            </button>
          )}
          <button
            className="btn-primary small"
            onClick={() => (last ? finish() : setStep(step + 1))}
          >
            {last ? "Start playing" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
