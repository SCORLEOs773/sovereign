import { formatGameDate, type SimState } from "@sovereign/shared";

export function EventsTab({ state }: { state: SimState }) {
  const events = [...state.events].reverse();
  return (
    <ul className="event-list">
      {events.map((e, i) => (
        <li key={`${e.tick}-${i}`} className={`event ${e.kind}`}>
          <span className="event-date">{formatGameDate(e.tick)}</span>
          <span>{e.text}</span>
        </li>
      ))}
    </ul>
  );
}
