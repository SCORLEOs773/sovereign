import { useEffect, useRef, useState } from "react";
import { useSimStore } from "../store/simStore";

export function NewsToast() {
  const signature = useSimStore((s) => {
    const events = s.state?.events;
    const last =
      events && events.length > 0 ? events[events.length - 1] : undefined;
    return last ? `${last.kind}|${last.tick}|${last.text}` : "";
  });
  const seen = useRef(signature);
  const [shown, setShown] = useState<{ kind: string; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (!signature || signature === seen.current) return;
    seen.current = signature;
    const parts = signature.split("|");
    setShown({ kind: parts[0] ?? "info", text: parts.slice(2).join("|") });
    const timer = window.setTimeout(() => setShown(null), 6000);
    return () => window.clearTimeout(timer);
  }, [signature]);

  if (!shown) return null;
  return <div className={`toast ${shown.kind}`}>{shown.text}</div>;
}
