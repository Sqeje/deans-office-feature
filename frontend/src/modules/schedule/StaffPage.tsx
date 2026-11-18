import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { ApiError } from "../../shared/api";
import { scheduleApi, toEvent, type ServerEvent, type UpdateEvent } from "./api";
import { addDays, dateKey, formatDay, formatTime, validDate, weekOf } from "./model";
import { ScheduleRow } from "./Rows";
import "./schedule.css";

const localTime = (value: string) => `${dateKey(new Date(value))}T${formatTime(value)}`;
const roomNumber = (value: string) => value.trimStart().replace(/^(?:ауд\.?\s*)+/i, "");
export function StaffPage() {
  const [day, setDay] = useState(() => dateKey(new Date()));
  const [category, setCategory] = useState<"lesson" | "assessment">("lesson");
  const [items, setItems] = useState<ServerEvent[]>();
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<string>();
  const [message, setMessage] = useState("");
  const monday = weekOf(day)[0];
  useEffect(() => {
    const controller = new AbortController();
    setItems(undefined); setError(undefined); setEditing(undefined);
    scheduleApi.staff(monday, addDays(monday, 6), category, controller.signal)
      .then(value => { if (!controller.signal.aborted) setItems(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause); });
    return () => controller.abort();
  }, [monday, category, attempt]);
  if (error instanceof ApiError && error.status === 401) return <Navigate to="/login" state={{ expired: true }} replace />;
  return <section className="schedule-page schedule-staff">
    <h1>Редактировать расписание</h1>
    <p className="muted">Можно изменить только свои локальные пары. Время московское, UTC+3.</p>
    <div className="schedule-staff-controls">
      <label>Неделя с датой<input type="date" value={day} onChange={e => { if (validDate(e.target.value)) setDay(e.target.value); }} /></label>
      <label>Тип событий<select value={category} onChange={e => setCategory(e.target.value as typeof category)}>
        <option value="lesson">Занятия</option><option value="assessment">Контрольные и экзамены</option>
      </select></label>
      <Button variant="outline" onClick={() => setAttempt(v => v + 1)}>Обновить</Button>
    </div>
    {message && <p role="status">{message}</p>}
    {error ? <div className="card" role="alert"><p>{error instanceof ApiError && error.status === 403 ? "Нет доступа к редактированию расписания." : "Не удалось загрузить расписание."}</p>
      <Button variant="outline" onClick={() => setAttempt(v => v + 1)}>Повторить</Button></div>
      : !items ? <p role="status">Загружаем расписание…</p>
      : items.length === 0 ? <div className="card"><h2>В выбранную неделю занятий нет</h2></div>
      : <div className="schedule-staff-list">{items.map(event => <article key={event.id} className="card">
        <p className="muted">Группа {event.groupName} · {formatDay(dateKey(new Date(event.startsAt)), { weekday: "long", day: "numeric", month: "long" })}{event.isDemo ? " · Демонстрационные данные" : ""}</p>
        <ul className="schedule-list"><ScheduleRow lesson={toEvent(event)} now={new Date()} /></ul>
        {event.isImported ? <p className="muted">Импортировано. Изменения принадлежат источнику.</p>
      : !event.canEdit ? <p className="muted">Изменение этой пары недоступно.</p>
          : editing !== event.id ? <Button variant="outline" onClick={() => { setEditing(event.id); setMessage(""); }}>Изменить занятие</Button>
          : <EditForm event={event} cancel={() => setEditing(undefined)} saved={() => { setMessage("Изменения сохранены."); setAttempt(v => v + 1); }} />}
      </article>)}</div>}
  </section>;
}
function EditForm({ event, cancel, saved }: { event: ServerEvent; cancel: () => void; saved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const original = { startsAt: localTime(event.startsAt), endsAt: localTime(event.endsAt), room: roomNumber(event.room),
    teacher: event.teacher, address: event.location.address, building: event.location.building, floor: String(event.location.floor) };
  const [values, setValues] = useState({ ...original, cancelled: event.status === "cancelled" });
  if (expired) return <Navigate to="/login" state={{ expired: true }} replace />;
  const fields = [
    ["startsAt", "Начало занятия", "datetime-local"], ["endsAt", "Окончание занятия", "datetime-local"],
    ["room", "Аудитория", "text"], ["teacher", "Преподаватель", "text"], ["address", "Адрес", "text"], ["building", "Корпус", "text"], ["floor", "Этаж", "number"],
  ] as const;
  return <form className="schedule-edit" aria-label="Изменение занятия" onSubmit={async e => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      const body: UpdateEvent = values.cancelled
        ? { startsAt: event.startsAt, endsAt: event.endsAt, room: event.room, teacher: event.teacher,
          address: event.location.address, building: event.location.building, floor: event.location.floor, cancelled: true, version: event.version }
        : { ...values, room: roomNumber(values.room).trim(), startsAt: `${values.startsAt}:00+03:00`, endsAt: `${values.endsAt}:00+03:00`, floor: Number(values.floor), version: event.version };
      await scheduleApi.update(event.id, body); saved();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) setExpired(true);
      setError(cause instanceof ApiError && cause.code === "schedule_conflict" ? "Занятие уже изменено. Обновите список перед новой правкой."
        : cause instanceof ApiError && cause.status === 403 ? "Нет доступа к изменению занятия."
        : cause instanceof ApiError && cause.status === 400 ? "Проверьте поля: окончание должно быть позже начала, длительность — не более 12 часов."
        : "Не удалось сохранить изменения. Попробуйте ещё раз.");
    } finally { setBusy(false); }
  }}>
    <h2>Изменить занятие</h2>
    <p className="muted">Московское время · UTC+3</p>
    <fieldset disabled={busy}><legend className="sr-only">Поля занятия</legend>
      <fieldset disabled={values.cancelled} aria-describedby={values.cancelled ? "schedule-cancel-hint" : undefined}>
        <legend className="sr-only">Время и место занятия</legend>
        <div className="schedule-edit-fields">{fields.map(([key, title, type]) => <label key={key}>{title}<input type={type} required value={values[key]}
          readOnly={key === "teacher"} spellCheck={key === "room" ? false : undefined}
          maxLength={key === "room" ? 95 : key === "building" ? 100 : 250} min={key === "floor" ? -5 : undefined} max={key === "floor" ? 100 : undefined}
          onChange={e => setValues(v => ({ ...v, [key]: key === "room" ? roomNumber(e.target.value) : e.target.value }))} /></label>)}</div>
      </fieldset>
      <label className="schedule-cancel-check"><input type="checkbox" checked={values.cancelled} onChange={e => setValues(v => e.target.checked ? { ...original, cancelled: true } : { ...v, cancelled: false })} />Занятие отменено</label>
      {values.cancelled && <p id="schedule-cancel-hint" className="muted" role="status">При отмене время и место занятия не меняются. Несохранённые правки сброшены.</p>}
      {error && <p role="alert">{error}</p>}
      <div className="schedule-edit-actions"><Button type="submit" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить изменения"}</Button><Button type="button" variant="outline" onClick={cancel}>Отмена</Button></div>
    </fieldset>
  </form>;
}
