export const SIM_CONFIG = {
  /** In-game start date (UTC): 1 January 2032, 00:00 */
  startDateUtc: Date.UTC(2032, 0, 1),
  /** In-game minutes per simulation tick */
  minutesPerTick: 10,
  /** Ticks per real second at 1x speed (10 in-game minutes per second) */
  ticksPerSecondAtSpeed1: 1,
  /** Most ticks one update may run, to avoid a catch-up spiral after throttling */
  maxCatchUpTicksPerFrame: 200,
  /** Longest real-time gap simulated when loading a save */
  maxOfflineSeconds: 8 * 60 * 60,
  /** Speed multiplier used for offline progression */
  offlineSpeed: 1,
} as const;

export const TICKS_PER_HOUR = 60 / SIM_CONFIG.minutesPerTick;
export const TICKS_PER_DAY = 24 * TICKS_PER_HOUR;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const pad = (n: number): string => String(n).padStart(2, "0");

export function tickToDate(tick: number): Date {
  return new Date(
    SIM_CONFIG.startDateUtc + tick * SIM_CONFIG.minutesPerTick * 60_000,
  );
}

/** Example: "15 March 2032 | 14:30" */
export function formatGameDateTime(tick: number): string {
  const d = tickToDate(tick);
  return `${dateFormatter.format(d)} | ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
