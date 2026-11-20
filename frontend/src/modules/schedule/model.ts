export const scheduleTimeZone = "Europe/Moscow";
export interface Lesson {
  id: string;
  startsAt: string;
  endsAt: string;
  title: string;
  kind: string;
  room: string;
  teacher: string;
  location?: Location;
  change:
    | { status: "scheduled" | "cancelled" }
    | { status: "rescheduled"; startsAt: string; endsAt: string; room: string; teacher: string; location?: Location };
}
export function changedFields(lesson: Lesson) {
  const previous = lesson.change;
  return {
    time: previous.status === "rescheduled" && (
      Date.parse(previous.startsAt) !== Date.parse(lesson.startsAt)
      || Date.parse(previous.endsAt) !== Date.parse(lesson.endsAt)
    ),
    room: previous.status === "rescheduled" && (previous.room !== lesson.room || (previous.location !== undefined && (previous.location.address !== lesson.location?.address || previous.location.building !== lesson.location?.building || previous.location.floor !== lesson.location?.floor))),
    teacher: previous.status === "rescheduled" && previous.teacher !== lesson.teacher,
  };
}
export type ScheduleSource = (weekStart: string, signal: AbortSignal) => Promise<Lesson[]>;

export function dateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: scheduleTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
// UTC is only a container for date-only arithmetic, never the browser's zone.
export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function weekOf(day: string): string[] {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  const monday = addDays(day, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export function formatDay(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("ru-RU", { ...options, timeZone: scheduleTimeZone })
    .format(new Date(`${day}T12:00:00+03:00`));
}
export function formatTime(instant: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: scheduleTimeZone, hour: "2-digit", minute: "2-digit",
  }).format(new Date(instant));
}
export function isCurrent(lesson: Lesson, now: Date): boolean {
  return lesson.change.status !== "cancelled"
    && Date.parse(lesson.startsAt) <= now.getTime()
    && now.getTime() < Date.parse(lesson.endsAt);
}
export function lessonsForDay(lessons: Lesson[], day: string): Lesson[] {
  return lessons.filter(l => dateKey(new Date(l.startsAt)) === day)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}


export interface Location { address: string; building: string; floor: number }
export interface ScheduleEvent extends Lesson {
  groupId: string;
  teacherId: string;
  location: Location;
  category: "lesson" | "assessment";
  assessmentResult?: "passed" | "absent" | "failed";
  serverBacked?: boolean;
  courseId?: string | null;
  groupName?: string;
}
export type Entity = { kind: "group" | "teacher"; id: string; name?: string; personal?: boolean; isDemo?: boolean };
export interface EventQuery { entity: Entity; category: "lesson" | "assessment"; start: string; end: string }
export type EventSource = (query: EventQuery, signal: AbortSignal) => Promise<ScheduleEvent[]>;

export function semesterOf(day: string): { start: string; end: string } {
  const year = Number(day.slice(0, 4)), month = Number(day.slice(5, 7));
  if (month === 1) return { start: `${year - 1}-09-01`, end: `${year}-01-31` };
  if (month >= 9) return { start: `${year}-09-01`, end: `${year + 1}-01-31` };
  return { start: `${year}-02-01`, end: `${year}-08-31` };
}
export function validDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 2100
    && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}


export function assessmentOutcome(event: Lesson & { category?: ScheduleEvent["category"]; assessmentResult?: ScheduleEvent["assessmentResult"]; serverBacked?: boolean }, now: Date) {
  if (event.serverBacked || event.category !== "assessment" || event.change.status === "cancelled" || Date.parse(event.endsAt) > now.getTime()) return null;
  return event.assessmentResult ?? "passed";
}
