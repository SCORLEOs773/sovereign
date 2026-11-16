import { HealthResponseSchema, type HealthResponse } from "@sovereign/shared";

// Empty in development (the Vite proxy handles it); set in production via VITE_API_URL
const API_BASE: string = import.meta.env.VITE_API_URL ?? "";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`API responded with ${res.status}`);
  return HealthResponseSchema.parse(await res.json());
}
