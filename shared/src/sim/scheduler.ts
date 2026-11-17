import { runMonthly } from "./monthly";
import type { SimState } from "./state";
import { TICKS_PER_DAY, TICKS_PER_HOUR, tickToDate } from "./time";

export interface ScheduledTask {
  id: string;
  /** The task runs whenever tick is a multiple of this number */
  everyTicks: number;
  run: (state: SimState) => void;
}

export class Scheduler {
  private readonly tasks: ScheduledTask[];

  constructor(tasks: ScheduledTask[]) {
    this.tasks = tasks;
  }

  runDue(state: SimState): void {
    for (const task of this.tasks) {
      if (state.tick % task.everyTicks === 0) task.run(state);
    }
  }
}

export function createDefaultScheduler(): Scheduler {
  return new Scheduler([
    {
      id: "calendar.hour",
      everyTicks: TICKS_PER_HOUR,
      run: (s) => {
        s.hours += 1;
      },
    },
    {
      id: "calendar.day",
      everyTicks: TICKS_PER_DAY,
      run: (s) => {
        s.days += 1;
      },
    },
    {
      id: "world.monthly",
      everyTicks: TICKS_PER_DAY,
      run: (s) => {
        if (tickToDate(s.tick).getUTCDate() === 1) {
          s.months += 1;
          runMonthly(s);
        }
      },
    },
  ]);
}
