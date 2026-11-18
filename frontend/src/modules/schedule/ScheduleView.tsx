import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../shared/api";
import { CalendarDays } from "lucide-react";
import { WeekPicker } from "./WeekPicker";
import { Button } from "../../components/ui/button";
import { scheduleSource } from "./source";
import { ScheduleRow } from "./Rows";
import { ExportButton } from "./ExportButton";
import { useSchedulePaths } from "./paths";
import { addDays, dateKey, formatDay, semesterOf, validDate, weekOf, type Entity, type EventSource, type ScheduleEvent } from "./model";

const systemNow = () => new Date();
const longDay = (day: string) => formatDay(day, { weekday: "long", day: "numeric", month: "long" });
const date = (day: string) => formatDay(day, { day: "numeric", month: "long", year: "numeric" });
type Load = { key: string; status: "loading" | "error"; error?: unknown } | { key: string; status: "success"; events: ScheduleEvent[] };
export function ScheduleView({ entity, heading, description, source = scheduleSource, getNow = systemNow }: { entity: Entity; heading?: string; description?: string; source?: EventSource; getNow?: () => Date }) {
  const [search, setSearch] = useSearchParams();
  const [now, setNow] = useState(getNow);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>({ key: "", status: "loading" });
  const today = dateKey(now);
  const category = search.get("kind") === "assessments" ? "assessment" : "lesson";
  const mode = search.get("view") === "week" ? "week" : "today";
  const rawWeek = search.get("week");
  const monday = mode === "week" && validDate(rawWeek) ? weekOf(rawWeek)[0] : weekOf(today)[0];
  const semester = semesterOf(today);
  const start = category === "assessment" ? semester.start : monday;
  const end = category === "assessment" ? semester.end : addDays(monday, 6);
  const key = `${entity.kind}/${entity.id}/${category}/${start}/${end}`;
  const { kind: entityKind, id: entityId } = entity;

  useEffect(() => {
    const refresh = () => setNow(getNow());
    const visible = () => { if (!document.hidden) refresh(); };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [getNow]);

  useEffect(() => {
    if (!entity.personal) return;
    const refresh = () => setAttempt(value => value + 1);
    const visible = () => { if (!document.hidden) refresh(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [entity.personal]);

  useEffect(() => {
    // Canonical URL state: malformed values fall back to a real date, never NaN.
    const next = new URLSearchParams(search);
    if (next.has("kind") && !["lessons", "assessments"].includes(next.get("kind")!)) next.delete("kind");
    if (next.has("view") && !["today", "week"].includes(next.get("view")!)) next.delete("view");
    if (next.has("week")) {
      if (!validDate(rawWeek)) next.delete("week");
      else next.set("week", weekOf(rawWeek)[0]);
    }
    if (next.toString() !== search.toString()) setSearch(next, { replace: true });
  }, [search, rawWeek, setSearch]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoad({ key, status: "loading" });
    async function fetch() {
      try {
        const events = await source({ entity: { kind: entityKind, id: entityId }, category, start, end }, controller.signal);
        if (active) setLoad({ key, status: "success", events });
      } catch (error) { if (active) setLoad({ key, status: "error", error }); }
    }
    void fetch();
    return () => { active = false; controller.abort(); };
  }, [key, entityKind, entityId, category, start, end, source, attempt]);

  useEffect(() => {
    if (load.key === key && load.status === "success" && search.get("event"))
      document.getElementById(`lesson-${search.get("event")}`)?.scrollIntoView({ block: "center" });
  }, [load, key, search]);

  function update(values: Record<string, string | null>) {
    const next = new URLSearchParams(search);
    for (const [name, value] of Object.entries(values)) { if (value === null) next.delete(name); else next.set(name, value); }
    setSearch(next);
  }
  const state = load.key === key ? load : { status: "loading" as const };
  const events = state.status === "success" ? [...state.events].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)) : [];
  const visible = events.filter(e => category === "assessment" || mode === "week" || dateKey(new Date(e.startsAt)) === today);
  const days = category === "assessment" ? [...new Set(visible.map(e => dateKey(new Date(e.startsAt))))]
    : mode === "today" ? [today] : weekOf(monday);
  const table = category === "lesson" && mode === "week";
  if (state.status === "error" && state.error instanceof ApiError && state.error.status === 401)
    return <Navigate to="/login" state={{ expired: true }} replace />;
  return <>
    <div className="schedule-view-header">
      <div>{heading && <h1>{heading}</h1>}{description && <p className="muted">{description}</p>}</div>
      <ExportButton key={`${key}/${mode}/${today}`} ready={state.status === "success"}
        schedule={{ entity, events: visible, category, mode, now,
          start: category === "lesson" && mode === "today" ? today : start,
          end: category === "lesson" && mode === "today" ? today : end }} />
    </div>
    <div className="schedule-modes schedule-kind-modes" role="group" aria-label="Тип событий">
      <Button variant="outline" aria-pressed={category === "lesson"} onClick={() => update({ kind: "lessons" })}>Занятия</Button>
      <Button variant="outline" aria-pressed={category === "assessment"} onClick={() => update({ kind: "assessments" })}>Контрольные и экзамены</Button>
    </div>
    {category === "lesson" ? <>
      <div className="schedule-modes" role="group" aria-label="Период занятий">
        <Button variant="outline" aria-pressed={mode === "today"} onClick={() => update({ view: "today", week: null })}>Сегодня</Button>
        <Button variant="outline" aria-pressed={mode === "week"} onClick={() => update({ view: "week" })}>Неделя</Button>
      </div>
      {mode === "week" && <div className="schedule-week-controls" role="group" aria-label="Навигация по неделям">
        <Button variant="outline" onClick={() => update({ week: addDays(monday, -7) })}>‹ Предыдущая неделя</Button>
        <WeekPicker selected={monday} today={today} onSelect={week => update({ week })} />
        <Button variant="outline" onClick={() => update({ week: addDays(monday, 7) })}>Следующая неделя ›</Button>
      </div>}
    </> : <p className="schedule-semester muted">Текущий семестр: {date(semester.start)} – {date(semester.end)} Включая прошедшие события.</p>}
    <p className="schedule-zone muted">Московское время · UTC+3</p>
    <div aria-busy={state.status === "loading"}>
      {state.status === "loading" ? <div className="card schedule-loading" role="status">Загружаем расписание…</div>
        : state.status === "error" ? <div className="card" role="alert"><p>{state.error instanceof ApiError && state.error.status === 403 ? "Нет доступа к расписанию." : "Не удалось загрузить расписание."}</p>{state.error instanceof ApiError && state.error.traceId && <p className="muted">Код обращения: {state.error.traceId}</p>}<Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Повторить</Button></div>
        : category === "assessment" && visible.length === 0 ? <Empty text="В этом семестре контрольных и экзаменов нет" />
        : days.map(day => {
          const lessons = visible.filter(e => dateKey(new Date(e.startsAt)) === day);
          return <section key={day} className={table ? "schedule-day-table" : "schedule-day"} aria-label={longDay(day)}>
            <h2 className="schedule-day-title"><time dateTime={day}>{longDay(day)}</time></h2>
            {table && lessons.length > 0 && <div className="schedule-table-labels" aria-hidden="true"><span>Время</span><span>Занятие</span><span>Место</span><span>{entity.kind === "teacher" ? "Группа" : "Преподаватель"}</span></div>}
            {lessons.length > 0 ? <ul className="schedule-list" aria-label={`Занятия: ${longDay(day)}`}>
              {lessons.map(lesson => <ScheduleRow key={lesson.id} lesson={lesson} now={now} teacherView={entity.kind === "teacher"} />)}
            </ul> : mode === "today" ? <Empty text="В этот день занятий нет" /> : <p className="schedule-empty-day muted">В этот день занятий нет</p>}
          </section>;
        })}
    </div>
  </>;
}
function Empty({ text }: { text: string }) {
  const { catalog } = useSchedulePaths();
  return <section className="card schedule-empty"><CalendarDays aria-hidden="true" /><h2>{text}</h2><Link to={catalog}>Выбрать другое расписание</Link></section>;
}
