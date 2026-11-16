import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  GAME_NAME,
  GAME_VERSION,
  type HealthResponse,
} from "@sovereign/shared";

const app = new Hono();

// Open CORS for now; we will restrict it to our site's domain later.
app.use("/api/*", cors());

app.get("/api/health", (c) => {
  const body: HealthResponse = {
    status: "ok",
    game: GAME_NAME,
    version: GAME_VERSION,
    serverTime: new Date().toISOString(),
  };
  return c.json(body);
});

app.get("/", (c) => c.text("SOVEREIGN backend is running."));
export default app;
