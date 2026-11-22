import { Link } from "react-router-dom";
import { scheduleApi } from "../schedule/api";
import { useRemote, RequestFailure } from "../academic-performance/remote";
async function loadNext(signal: AbortSignal) {
  const context = await scheduleApi.teacherContext(signal);
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:context.timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part = (type:string) => parts.find(p => p.type === type)!.value;
  const start = part("year") + "-" + part("month") + "-" + part("day");
  const endDate = new Date(start + "T00:00:00Z"); endDate.setUTCDate(endDate.getUTCDate()+7);
  const data = await scheduleApi.teacherMine(start, endDate.toISOString().slice(0,10), "lesson", signal);
  return { timeZone:context.timeZone, event:data.events.filter(e => e.status !== "cancelled" && Date.parse(e.endsAt) > Date.now()).sort((a,b) => Date.parse(a.startsAt)-Date.parse(b.startsAt))[0] };
}
export function TeacherNext() {
  const next = useRemote("teacher-next", loadNext);
  return <section className="academic-panel staff-next"><h2>Ближайшее занятие</h2>{next.error ? <RequestFailure error={next.error} retry={next.retry} title="Не удалось загрузить занятие" /> : !next.data ? <p role="status">Загружаем расписание…</p> : next.data.event ? <><h3>{next.data.event.title}</h3><p>{next.data.event.groupName} · {new Intl.DateTimeFormat("ru-RU", { timeZone: next.data.timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(next.data.event.startsAt))} · {next.data.event.room}</p><Link to="/staff/schedule">Открыть моё расписание</Link></> : <p>В ближайшие семь дней занятий нет.</p>}</section>;
}
