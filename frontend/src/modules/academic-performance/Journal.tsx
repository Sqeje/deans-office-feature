import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { components } from "../../shared/schema";
import { ApiError } from "../../shared/api";
import { Button } from "../../components/ui/button";
import { SelectField } from "../../components/ui/primitives";
import { loadStaffContext } from "../identity/staffContext";
import { dateKey, formatDay, formatTime } from "../schedule/model";
import { loadJournal, saveJournal } from "./api";
import { useRemote, RequestFailure } from "./remote";
import { formatSemesterLabel } from "./model";

export function Journal() {
  const [query, setQuery] = useSearchParams();
  const context = useRemote("staff-context", loadStaffContext);
  const courseId = query.get("course") ?? "";
  const load = useCallback((signal: AbortSignal) => loadJournal(courseId, signal), [courseId]);
  const assignments = context.data?.assignments ?? [];
  const assignment = assignments.find(a => a.courseId === courseId);
  const groups = context.data?.groups ?? [];
  const journal = useRemote(assignment ? courseId : "", load);
  const lessonId = query.get("lesson") ?? "";
  const lesson = journal.data?.lessons.find(l => l.lessonId === lessonId);
  return <div className="journal">
    <p className="muted">Текущие оценки и посещаемость сохраняются отдельно от итоговой аттестации.</p>
    {context.error ? <RequestFailure error={context.error} retry={context.retry} /> : !context.data ? <p role="status">Загружаем назначения…</p> : !assignments.length ? <p>Учебных назначений пока нет.</p> : <SelectField id="journal-course" label="Группа и дисциплина" value={courseId} onChange={e => { setQuery({ view: "journal", course: e.target.value }); }}>
      <option value="">Выберите назначение</option>
      {assignments.map(a => {
        const groupName = groups.find(g => g.id === a.groupId)?.name;
        const repeated = assignments.some(other => other.courseId !== a.courseId && other.groupId === a.groupId && other.courseName === a.courseName);
        const label = [groupName, a.courseName, repeated && formatSemesterLabel(a.semesterId)].filter(Boolean).join(" · ");
        return <option value={a.courseId} key={a.id}>{label}</option>;
      })}
    </SelectField>}
    {assignment && (journal.error ? <RequestFailure error={journal.error} retry={journal.retry} /> : !journal.data ? <p role="status">Загружаем журнал…</p> : <>
      <SelectField id="journal-lesson" label="Занятие" value={lessonId} onChange={e => setQuery({ view: "journal", course: courseId, lesson: e.target.value })}>
        <option value="">Выберите занятие</option>
        {journal.data.lessons.map(l => (
          <option key={l.lessonId} value={l.lessonId}>
            {formatDay(dateKey(new Date(l.startsAt)), { day: "2-digit", month: "2-digit" })} · {formatTime(l.startsAt)}{l.isCancelled ? " · Отменено" : ""}
          </option>
        ))}
      </SelectField>
      <section className="academic-panel journal-details" aria-label="Сведения о назначении">
        <dl>
          <div><dt>Группа</dt><dd>{groups.find(g => g.id === assignment.groupId)?.name ?? "—"}</dd></div>
          <div><dt>Дисциплина</dt><dd>{assignment.courseName}</dd></div>
          <div><dt>Семестр</dt><dd>{formatSemesterLabel(assignment.semesterId)}</dd></div>
        </dl>
        {lesson && <div className="journal-lesson-details">
          <time dateTime={lesson.startsAt}>{formatDay(dateKey(new Date(lesson.startsAt)), { day: "numeric", month: "long", year: "numeric" })} · {formatTime(lesson.startsAt)}</time>
          <h2 id="journal-lesson-topic">{lesson.subject}</h2>
        </div>}
      </section>
      {!journal.data.lessons.length && <p>Занятий по этой дисциплине пока нет.</p>}
      {lesson && <LessonEditor key={lesson.lessonId} lesson={lesson} courseId={courseId} />}
    </>)}
  </div>;
}
function LessonEditor({ lesson, courseId }: { lesson: components["schemas"]["JournalLessonDto"]; courseId: string }) {
  const [rows, setRows] = useState(lesson.rows);
  const [version, setVersion] = useState(Number(lesson.version));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [latest, setLatest] = useState<typeof lesson>();
  const conflict = error instanceof ApiError && error.status === 409;
  return <><form id="journal-lesson-editor" className="academic-panel performance-result-form" aria-labelledby="journal-lesson-topic" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(undefined); setSaved(false);
    try { await saveJournal(lesson.lessonId, { version, rows }); setVersion(version + 1); setSaved(true); }
    catch (cause) { setError(cause); } finally { setBusy(false); }
  }}>
    {!lesson.canEdit && <p role="note">{lesson.readOnlyReason || "Занятие доступно только для просмотра."}</p>}
    {!rows.length && <p>В группе пока нет студентов.</p>}
    {rows.map((row, index) => <fieldset className="journal-student" key={row.studentId} disabled={busy || !lesson.canEdit || conflict}>
      <legend>{row.fullName}</legend>
      <SelectField id={"grade-" + index} label="Оценка" value={row.grade ?? ""} onChange={e => { const value = e.target.value; setSaved(false); setRows(rows.map((r, i) => i === index ? { ...r, grade: value ? Number(value) : null } : r)); }}><option value="">Нет оценки</option>{[2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}</SelectField>
      <SelectField id={"attendance-" + index} label="Посещаемость" value={row.attendance} onChange={e => { const value = e.target.value as typeof row.attendance; setSaved(false); setRows(rows.map((r,i) => i === index ? { ...r, attendance: value } : r)); }}><option value="unmarked">Не указано</option><option value="present">Был</option><option value="absent">Не был</option></SelectField>
    </fieldset>)}
    {!!error && <p role="alert">{conflict ? "Журнал изменился в другой вкладке. Ваш черновик сохранён на экране. Сравните его с актуальными данными перед повтором." : "Не удалось сохранить журнал. Ваши изменения сохранены на экране."}</p>}
    {conflict && <Button type="button" variant="outline" onClick={async () => {
      setBusy(true);
      try { const fresh = await loadJournal(courseId, new AbortController().signal); const current = fresh.lessons.find(l => l.lessonId === lesson.lessonId); if (current) setLatest(current); } catch (cause) { setError(cause); } finally { setBusy(false); }
    }}>Загрузить актуальные данные для сравнения</Button>}
    {latest && <section><h3>Актуальные данные сервера</h3>{latest.rows.map(r => <p key={r.studentId}>{r.fullName}: {r.grade ?? "Без оценки"} · {r.attendance === "present" ? "Присутствовал" : r.attendance === "absent" ? "Отсутствовал" : "Не отмечено"}</p>)}{!latest.canEdit ? <p>{latest.readOnlyReason}</p> : <Button type="button" variant="outline" disabled={busy} onClick={() => { setVersion(Number(latest.version)); setError(undefined); setLatest(undefined); }}>Продолжить с моим черновиком</Button>}</section>}
  </form>
  <div className={lesson.canEdit && rows.length ? "journal-actions journal-actions-sticky" : "journal-actions"}>
    {saved && <p role="status">Журнал сохранён.</p>}
    <Button type="submit" form="journal-lesson-editor" variant="primary" disabled={busy || !lesson.canEdit || conflict || !rows.length}>{busy ? "Сохраняем…" : "Сохранить журнал"}</Button>
  </div></>;
}
