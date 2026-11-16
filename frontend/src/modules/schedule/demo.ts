import { addDays, type Lesson, type ScheduleSource } from "./model";

// Fictional fixtures, never a fallback for a failed server request.
export const demoSchedule: ScheduleSource = async (weekStart, signal) => {
  signal.throwIfAborted();
  const lessons: Lesson[] = [];
  for (let i = 0; i < 6; i++) {
    const day = addDays(weekStart, i);
    const instant = (time: string) => `${day}T${time}:00+03:00`;
    lessons.push(
      {
        id: `demo-${day}-programming`, title: "Программирование",
        startsAt: instant("12:10"), endsAt: instant("13:40"),
        kind: "Лекция", room: "Ауд. 305", teacher: "И. В. Лебедев",
        change: { status: "scheduled" },
      },
      {
        id: `demo-${day}-english`, title: "Английский язык",
        startsAt: instant("14:00"), endsAt: instant("15:30"),
        kind: "Практика", room: "Ауд. 402", teacher: "М. П. Орлова",
        change: i === 2 ? {
          status: "rescheduled", startsAt: instant("13:00"),
          endsAt: instant("14:30"), room: "Ауд. 301", teacher: "М. П. Орлова",
        } : { status: "scheduled" },
      },
      {
        id: `demo-${day}-databases`, title: "Базы данных",
        startsAt: instant("16:00"), endsAt: instant("17:30"),
        kind: "Практика", room: "Ауд. 307", teacher: "А. В. Миронов",
        change: { status: i === 2 ? "cancelled" : "scheduled" },
      },
    );
  }
  return lessons;
};
