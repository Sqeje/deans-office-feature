import { demoSchedule } from "./demo";
import { groups, teachers } from "./catalog";
import { addDays, dateKey, semesterOf, weekOf, type EventSource, type ScheduleEvent } from "./model";

// One canonical fixture generator feeds every group and teacher projection.
export const scheduleSource: EventSource = async (query, signal) => {
  signal.throwIfAborted();
  const events: ScheduleEvent[] = [];
  const location = { address: "ул. Учебная, 10", building: "1", floor: 3 };
  if (query.category === "lesson") {
    for (let monday = weekOf(query.start)[0]; monday <= query.end; monday = addDays(monday, 7)) {
      const base = await demoSchedule(monday, signal);
      for (const [index, group] of groups.entries()) {
        for (const lesson of base.filter(l => index === 0 || l.id.endsWith("programming"))) {
          const day = dateKey(new Date(lesson.startsAt));
          const teacher = index === 0 ? teachers.find(t => t.shortName === lesson.teacher)! : teachers[(index - 1) % teachers.length];
          const slot = ["08:00", "09:40", "11:20", "17:50"][index - 1];
          const [hour, minute] = index === 0 ? [0, 0] : slot.split(":").map(Number);
          const end = hour * 60 + minute + 90;
          events.push({
            ...lesson, id: `${group.id}-${lesson.id}`, groupId: group.id, teacherId: teacher.id,
            teacher: teacher.shortName, location, category: "lesson",
            ...(index === 0 ? {} : {
              title: ["Теория алгоритмов", "Экономика предприятия", "Практика перевода", "Математический анализ"][index - 1],
              startsAt: `${day}T${slot}:00+03:00`,
              endsAt: `${day}T${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}:00+03:00`,
              change: { status: "scheduled" as const },
            }),
          });
        }
      }
    }
  } else {
    const semester = semesterOf(query.start);
    for (const [index, group] of groups.entries()) {
      for (const [i, offset] of [7, 10, 14, 72, 76, 80].entries()) {
        const day = addDays(semester.start, offset + index);
        const teacher = teachers[i % teachers.length];
        events.push({
          id: `${group.id}-${semester.start}-assessment-${i}`, groupId: group.id, teacherId: teacher.id,
          teacher: teacher.shortName, category: "assessment", location, room: "Ауд. 305",
          title: ["Теория алгоритмов", "Компьютерные сети", "Дискретная математика", "Базы данных", "Математика", "Программирование"][i],
          kind: ["Контрольная работа", "Контрольная работа", "Контрольная работа", "Контрольная работа", "Зачёт", "Экзамен"][i],
          assessmentResult: i === 0 ? "absent" : i === 1 ? "failed" : "passed",
          startsAt: `${day}T10:00:00+03:00`, endsAt: `${day}T11:30:00+03:00`, change: { status: "scheduled" },
        });
      }
    }
  }
  signal.throwIfAborted();
  return events.filter(e => {
    const day = dateKey(new Date(e.startsAt));
    return day >= query.start && day <= query.end && (query.entity.kind === "group" ? e.groupId === query.entity.id : e.teacherId === query.entity.id);
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
};
