export const SIM_CONFIG = {
  /** In-game start date (UTC): 1 January 2032, 00:00 */
  startDateUtc: Date.UTC(2032, 0, 1),
  startYear: 2032,
  /** In-game minutes per simulation tick */
  minutesPerTick: 10,
  /** Ticks per real second at 1x speed. 24 ticks = 4 in-game hours per second. */
  ticksPerSecondAtSpeed1: 24,
  /** Most ticks one update may run, to avoid a catch-up spiral after throttling */
  maxCatchUpTicksPerFrame: 400,
  /** Longest real-time gap simulated when loading a save */
  maxOfflineSeconds: 4 * 60 * 60,
  /** Offline time passes at this fraction of 1x speed */
  offlineSpeed: 0.25,
  electionIntervalYears: 4,
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

/** Example: "15 March 2032" */
export function formatGameDate(tick: number): string {
  return dateFormatter.format(tickToDate(tick));
}

/** Example: "15 March 2032 | 14:30" */
export function formatGameDateTime(tick: number): string {
  const d = tickToDate(tick);
  return `${dateFormatter.format(d)} | ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Elections happen on 1 January every four years after the start year. */
export function isElectionYear(year: number): boolean {
  const diff = year - SIM_CONFIG.startYear;
  return diff > 0 && diff % SIM_CONFIG.electionIntervalYears === 0;
}

export function nextElectionYear(tick: number): number {
  const year = tickToDate(tick).getUTCFullYear();
  const n = SIM_CONFIG.electionIntervalYears;
  return (
    SIM_CONFIG.startYear +
    n * (Math.floor((year - SIM_CONFIG.startYear) / n) + 1)
  );
}
