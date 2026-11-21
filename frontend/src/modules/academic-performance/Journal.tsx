import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { components } from "../../shared/schema";
import { ApiError } from "../../shared/api";
import { Button } from "../../components/ui/button";
import { SelectField } from "../../components/ui/primitives";
import { loadStaffContext } from "../identity/staffContext";
import { loadJournal, saveJournal } from "./api";
import { useRemote, RequestFailure } from "./remote";
import { formatSemesterLabel } from "./model";

export function Journal() {
  const [query, setQuery] = useSearchParams();
  const context = useRemote("staff-context", loadStaffContext);
  const courseId = query.get("course") ?? "";
  const load = useCallback((signal: AbortSignal) => loadJournal(courseId, signal), [courseId]);
  const assigned = !!context.data?.assignments.some(a => a.courseId === courseId);
  const journal = useRemote(assigned ? courseId : "", load);
  const lessonId = query.get("lesson") ?? "";
  const lesson = journal.data?.lessons.find(l => l.lessonId === lessonId);
  return <>
    <p className="muted">Текущие оценки и посещаемость сохраняются отдельно от итоговой аттестации.</p>
    {context.error ? <RequestFailure error={context.error} retry={context.retry} /> : !context.data ? <p role="status">Загружаем назначения…</p> : !context.data.assignments.length ? <p>Учебных назначений пока нет.</p> : <SelectField id="journal-course" label="Группа и дисциплина" value={courseId} onChange={e => { setQuery({ view: "journal", course: e.target.value }); }}>
      <option value="">Выберите назначение</option>{context.data.assignments.map(a => <option value={a.courseId} key={a.id}>{context.data?.groups.find(g => g.id === a.groupId)?.name} · {a.courseName} · {formatSemesterLabel(a.semesterId)}</option>)}
    </SelectField>}
    {courseId && assigned && (journal.error ? <RequestFailure error={journal.error} retry={journal.retry} /> : !journal.data ? <p role="status">Загружаем журнал…</p> : <>
      <SelectField id="journal-lesson" label="Занятие" value={lessonId} onChange={e => setQuery({ view: "journal", course: courseId, lesson: e.target.value })}><option value="">Выберите занятие</option>{journal.data.lessons.map(l => <option key={l.lessonId} value={l.lessonId}>{new Date(l.startsAt).toLocaleString("ru-RU")} · {l.subject}{l.isCancelled ? " · Отменено" : ""}</option>)}</SelectField>
      {!journal.data.lessons.length && <p>Занятий по этой дисциплине пока нет.</p>}
      {lesson && <LessonEditor key={lesson.lessonId} lesson={lesson} courseId={courseId} />}
    </>)}
  </>;
}
function LessonEditor({ lesson, courseId }: { lesson: components["schemas"]["JournalLessonDto"]; courseId: string }) {
  const [rows, setRows] = useState(lesson.rows);
  const [version, setVersion] = useState(Number(lesson.version));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [latest, setLatest] = useState<typeof lesson>();
  const conflict = error instanceof ApiError && error.status === 409;
  return <form className="academic-panel performance-result-form" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(undefined); setSaved(false);
    try { await saveJournal(lesson.lessonId, { version, rows }); setVersion(version + 1); setSaved(true); }
    catch (cause) { setError(cause); } finally { setBusy(false); }
  }}>
    <h2>{lesson.subject}</h2>
    {!lesson.canEdit && <p role="note">{lesson.readOnlyReason || "Занятие доступно только для просмотра."}</p>}
    {!rows.length && <p>В группе пока нет студентов.</p>}
    {rows.map((row, index) => <fieldset className="journal-student" key={row.studentId} disabled={busy || !lesson.canEdit || conflict}>
      <legend>{row.fullName}</legend>
      <SelectField id={"grade-" + index} label="Оценка" value={row.grade ?? ""} onChange={e => { const value = e.target.value; setSaved(false); setRows(rows.map((r, i) => i === index ? { ...r, grade: value ? Number(value) : null } : r)); }}><option value="">Не выставлена</option>{[2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}</SelectField>
      <SelectField id={"attendance-" + index} label="Посещаемость" value={row.attendance} onChange={e => { const value = e.target.value as typeof row.attendance; setSaved(false); setRows(rows.map((r,i) => i === index ? { ...r, attendance: value } : r)); }}><option value="unmarked">Не отмечено</option><option value="present">Присутствовал</option><option value="absent">Отсутствовал</option></SelectField>
    </fieldset>)}
    {!!error && <p role="alert">{conflict ? "Журнал изменился в другой вкладке. Ваш черновик сохранён на экране. Сравните его с актуальными данными перед повтором." : "Не удалось сохранить журнал. Ваши изменения сохранены на экране."}</p>}
    {conflict && <Button type="button" variant="outline" onClick={async () => {
      setBusy(true);
      try { const fresh = await loadJournal(courseId, new AbortController().signal); const current = fresh.lessons.find(l => l.lessonId === lesson.lessonId); if (current) setLatest(current); } catch (cause) { setError(cause); } finally { setBusy(false); }
    }}>Загрузить актуальные данные для сравнения</Button>}
    {latest && <section><h3>Актуальные данные сервера</h3>{latest.rows.map(r => <p key={r.studentId}>{r.fullName}: {r.grade ?? "Без оценки"} · {r.attendance === "present" ? "Присутствовал" : r.attendance === "absent" ? "Отсутствовал" : "Не отмечено"}</p>)}{!latest.canEdit ? <p>{latest.readOnlyReason}</p> : <Button type="button" variant="outline" disabled={busy} onClick={() => { setVersion(Number(latest.version)); setError(undefined); setLatest(undefined); }}>Продолжить с моим черновиком</Button>}</section>}
    {saved && <p role="status">Журнал сохранён.</p>}
    <Button type="submit" variant="primary" disabled={busy || !lesson.canEdit || conflict || !rows.length}>{busy ? "Сохраняем…" : "Сохранить журнал"}</Button>
  </form>;
}
