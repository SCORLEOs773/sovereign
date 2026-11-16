import { useEffect, useState } from "react";
import {
  GAME_NAME,
  GAME_SUBTITLE,
  GAME_TAGLINE,
  GAME_VERSION,
  type HealthResponse,
} from "@sovereign/shared";
import { fetchHealth } from "./api";
import { DeveloperCredit } from "./components/DeveloperCredit";

type ApiStatus =
  | { state: "loading" }
  | { state: "online"; data: HealthResponse }
  | { state: "offline"; message: string };

export function App() {
  const [status, setStatus] = useState<ApiStatus>({ state: "loading" });

  useEffect(() => {
    fetchHealth()
      .then((data) => setStatus({ state: "online", data }))
      .catch((err: unknown) =>
        setStatus({
          state: "offline",
          message: err instanceof Error ? err.message : "Unknown error",
        }),
      );
  }, []);

  return (
    <main className="shell">
      <h1 className="title">{GAME_NAME}</h1>
      <h2 className="subtitle">{GAME_SUBTITLE}</h2>
      <p className="tagline">{GAME_TAGLINE}</p>

      <section className="panel">
        <div className="panel-row">
          <span className="label">Game version</span>
          <span>{GAME_VERSION}</span>
        </div>
        <div className="panel-row">
          <span className="label">Backend</span>
          {status.state === "loading" && (
            <span className="muted">Connecting…</span>
          )}
          {status.state === "online" && <span className="ok">Online</span>}
          {status.state === "offline" && <span className="bad">Offline</span>}
        </div>
        {status.state === "online" && (
          <div className="panel-row">
            <span className="label">Server time</span>
            <span>{new Date(status.data.serverTime).toLocaleTimeString()}</span>
          </div>
        )}
        {status.state === "offline" && (
          <p className="error">{status.message}</p>
        )}
      </section>

      <DeveloperCredit />
    </main>
  );
}
