import { useEffect, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { teachers } from "./catalog";
import { useSchedulePaths } from "./paths";
export function TeacherButton({ teacherId, teacherName }: { teacherId: string; teacherName?: string }) {
  const { base } = useSchedulePaths();
  const teacher = teachers.find(t => t.id === teacherId) ?? (teacherName ? { id: teacherId, name: teacherName, shortName: teacherName } : undefined);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);
  const id = useId();
  const [search] = useSearchParams();
  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  if (!teacher) return <span>Преподаватель не указан</span>;
  return (
    <span className="schedule-teacher-control" ref={root} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button type="button" className="schedule-teacher-link" ref={trigger} aria-expanded={open} aria-controls={id}
        onClick={() => setOpen(value => !value)}>{teacher.shortName}</button>
      {open && <span className="schedule-teacher-popover" id={id} role="group" aria-label={`Карточка: ${teacher.name}`}>
        <strong>{teacher.name}</strong><span className="muted">Преподаватель</span>
        <Link ref={firstLink} to={`${base}/teachers/${teacher.id}?${search.toString()}`} onClick={() => setOpen(false)}>Посмотреть расписание →</Link>
      </span>}
    </span>
  );
}
