// Browser-only component harness. Vite resolves the same React/Router imports as production.
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ScheduleView } from "../src/modules/schedule/ScheduleView";
import { scheduleSource } from "../src/modules/schedule/source";
import type { EventQuery, ScheduleEvent } from "../src/modules/schedule/model";
export function mountControlled(host: HTMLElement) {
  const requests: { query: EventQuery; signal: AbortSignal; resolve: (data: ScheduleEvent[]) => void; reject: (error: Error) => void }[] = [];
  let now = new Date("2026-11-11T12:30:00+03:00");
  const source = (query: EventQuery, signal: AbortSignal) => new Promise<ScheduleEvent[]>((resolve, reject) => requests.push({ query, signal, resolve, reject }));
  createRoot(host).render(<MemoryRouter><ScheduleView entity={{ kind: "group", id: "pi-21" }} source={source} getNow={() => now} /></MemoryRouter>);
  return {
    count: () => requests.length,
    reject: (i: number) => requests[i].reject(new Error("test failure")),
    resolve: async (i: number, empty = false, long = false) => {
      const events = await scheduleSource(requests[i].query, new AbortController().signal);
      if (long) for (const event of events) {
        event.title = "Очень длинная дисциплина и дополнительные практические разделы";
        event.location = { ...event.location, address: "Очень длинный адрес учебного корпуса для проверки переносов" };
      }
      requests[i].resolve(empty ? [] : events);
    },
    jump: (value: string) => { now = new Date(value); window.dispatchEvent(new Event("focus")); },
    aborted: (i: number) => requests[i].signal.aborted,
  };
}
