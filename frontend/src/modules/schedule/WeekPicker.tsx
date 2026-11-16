import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { addDays, formatDay, weekOf } from "./model";
const date = (day: string) => formatDay(day, { day: "numeric", month: "long", year: "numeric" });
function shiftMonth(month: string, delta: number) {
  const value = new Date(`${month}-01T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + delta);
  return value.toISOString().slice(0, 7);
}
export function WeekPicker({ selected, today, onSelect }: { selected: string; today: string; onSelect: (monday: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(selected.slice(0, 7));
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const id = useId();
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const weeks: string[] = [];
  for (let day = weekOf(first)[0]; day <= last; day = addDays(day, 7)) weeks.push(day);
  useEffect(() => {
    if (!open) return;
    dialog.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  return <div className="schedule-week-picker" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button type="button" className="schedule-week-trigger" aria-label="Выбрать неделю" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} ref={trigger}
      onClick={() => { if (!open) setMonth(selected.slice(0, 7)); setOpen(value => !value); }}>
      <CalendarDays aria-hidden="true" /><span>{date(selected)} – {date(addDays(selected, 6))}</span>
    </button>
    {open && <div className="schedule-week-calendar" role="dialog" aria-modal="false" aria-label="Выбор недели" id={id} ref={dialog}>
      <div className="schedule-calendar-heading"><strong>Выбор недели</strong><button type="button" aria-label="Закрыть календарь" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X aria-hidden="true" /></button></div>
      <div className="schedule-calendar-month">
        <button type="button" aria-label="Предыдущий месяц" disabled={month === "1900-01"} onClick={() => setMonth(value => shiftMonth(value, -1))}><ChevronLeft aria-hidden="true" /></button>
        <label htmlFor={`${id}-month`} className="sr-only">Месяц</label>
        <select id={`${id}-month`} value={month.slice(5)} onChange={event => setMonth(value => `${value.slice(0, 4)}-${event.target.value}`)}>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map(value => <option key={value} value={value}>{formatDay(`2026-${value}-01`, { month: "long" })}</option>)}
        </select>
        <label htmlFor={`${id}-year`} className="sr-only">Год</label>
        <select id={`${id}-year`} value={month.slice(0, 4)} onChange={event => setMonth(value => `${event.target.value}-${value.slice(5)}`)}>
          {Array.from({ length: 201 }, (_, i) => String(1900 + i)).map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <button type="button" aria-label="Следующий месяц" disabled={month === "2100-12"} onClick={() => setMonth(value => shiftMonth(value, 1))}><ChevronRight aria-hidden="true" /></button>
      </div>
      <p className="sr-only" role="status">{formatDay(first, { month: "long", year: "numeric" })}</p>
      <div className="schedule-calendar-weekdays" aria-hidden="true">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => <span key={day}>{day}</span>)}</div>
      <div className="schedule-calendar-weeks">{weeks.map(monday => <button type="button" key={monday} className="schedule-calendar-week"
        aria-pressed={selected === monday} aria-label={`Неделя с ${date(monday)} по ${date(addDays(monday, 6))}`}
        onClick={() => { onSelect(monday); setOpen(false); trigger.current?.focus(); }}>
        {weekOf(monday).map(day => <span key={day} data-outside={day.slice(0, 7) !== month || undefined} aria-current={day === today ? "date" : undefined} title={day === today ? `Сегодня, ${date(day)}` : undefined}>{Number(day.slice(8))}</span>)}
      </button>)}</div>
    </div>}
  </div>;
}
