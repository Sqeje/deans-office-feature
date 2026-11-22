import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { components } from "../../shared/schema";
import { ApiError } from "../../shared/api";
import { useSession } from "../../shared/session";
import { Button } from "../../components/ui/button";
import { SelectField, Skeleton } from "../../components/ui/primitives";
import { formatDay, dateKey, formatTime } from "../schedule/model";
import { loadStaffContext } from "../identity/staffContext";
import { useRemote, RequestFailure } from "./remote";
import { formatSemesterLabel } from "./model";
import { loadJournal, loadJournalCourses, saveJournal } from "./api";

type JournalLesson = components["schemas"]["JournalLessonDto"];
type JournalRow = components["schemas"]["JournalRowDto"];
type JournalCourse = components["schemas"]["JournalCourseDto"];
type Attendance = components["schemas"]["AttendanceMark"];

export function Journal() {
  const [query, setQuery] = useSearchParams();
  const { session } = useSession();
  const context = useRemote("staff-context", loadStaffContext);
  const isDean = !!context.data?.roles.includes("Dean");
  const assignments = context.data?.assignments ?? [];
  const groups = context.data?.groups ?? [];
  const deanCoursesLoad = useCallback((signal: AbortSignal) => loadJournalCourses(signal), []);
  const deanCourses = useRemote(isDean ? "dean-journal-courses" : "", deanCoursesLoad);
  const courseId = query.get("course") ?? "";
  const lessonLoad = useCallback((signal: AbortSignal) => loadJournal(courseId, signal), [courseId]);
  const teacherCourse = assignments.find(x => x.courseId === courseId);
  const deanCourse = deanCourses.data?.find(x => x.courseId === courseId);
  const selectedCourse = isDean ? deanCourse : teacherCourse ? {
    ...teacherCourse,
    groupName: groups.find(g => g.id === teacherCourse.groupId)?.name ?? "Группа",
  } : undefined;
  const journal = useRemote(selectedCourse ? courseId : "", lessonLoad);
  const lessons = journal.data?.lessons ?? [];
  const courseChoices: JournalCourse[] = isDean
    ? deanCourses.data ?? []
    : assignments.map(x => ({
      courseId: x.courseId,
      courseName: x.courseName,
      groupId: x.groupId,
      groupName: groups.find(g => g.id === x.groupId)?.name ?? "Группа",
      semesterId: x.semesterId,
    }));
  const defaultCourseId = isDean ? deanCourses.data?.[0]?.courseId : courseChoices[0]?.courseId;

  useEffect(() => {
    if (!courseId && defaultCourseId) {
      setQuery({ view: "journal", course: defaultCourseId }, { replace: true });
    }
  }, [courseId, defaultCourseId, setQuery]);

  return <div className="journal">
    {context.error ? <RequestFailure error={context.error} retry={context.retry} /> : !context.data ? <p role="status">Загружаем назначения…</p> : !isDean && !assignments.length ? <p>Учебных назначений пока нет.</p> : null}
    {context.data && (isDean
      ? deanCourses.error
        ? <RequestFailure error={deanCourses.error} retry={deanCourses.retry} hideDeniedForDean />
        : !deanCourses.data ? <p role="status">Загружаем дисциплины…</p>
          : !deanCourses.data.length ? <p>Нет дисциплин в группах, доступных для исправления оценок.</p>
            : <SelectField id="journal-course" label="Группа и дисциплина" value={courseId} onChange={e => setQuery({ view: "journal", course: e.target.value })}>
              <option value="">Выберите группу и дисциплину</option>
              {deanCourses.data.map(x => <option value={x.courseId} key={x.courseId}>{x.groupName} · {x.courseName} · {formatSemesterLabel(x.semesterId)}</option>)}
            </SelectField>
      : !!assignments.length && <SelectField id="journal-course" label="Группа и дисциплина" value={courseId} onChange={e => setQuery({ view: "journal", course: e.target.value })}>
        <option value="">Выберите назначение</option>
        {courseChoices.map(x => <option value={x.courseId} key={x.courseId}>{x.groupName} · {x.courseName} · {formatSemesterLabel(x.semesterId)}</option>)}
      </SelectField>)}

    {selectedCourse && (journal.error
      ? <RequestFailure error={journal.error} retry={journal.retry} hideDeniedForDean={isDean} />
      : !journal.data ? <p role="status">Загружаем журнал…</p>
        : <>
          {!lessons.length
            ? <p>Занятий по этой дисциплине пока нет.</p>
            : <JournalMatrix lessons={lessons} courseId={courseId} courseName={selectedCourse.courseName} isDean={isDean} reload={journal.retry} />}
        </>)}
  </div>;
}

function JournalMatrix({ lessons, courseId, courseName, isDean, reload }: {
  lessons: JournalLesson[];
  courseId: string;
  courseName: string;
  isDean: boolean;
  reload: () => void;
}) {
  const [currentLessons, setCurrentLessons] = useState(lessons);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [correction, setCorrection] = useState<{ lesson: JournalLesson; row: JournalRow; grade: string; reason: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const ordered = [...currentLessons].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const students = ordered[0]?.rows ?? [];
  const session = useSession().session;
  const canTeach = !isDean && !!session?.roles.includes("Teacher");

  useEffect(() => setCurrentLessons(lessons), [lessons]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (correction && !element.open) element.showModal();
    else if (!correction && element.open) element.close();
  }, [correction]);

  async function saveCell(lesson: JournalLesson, row: JournalRow, grade: number | null, attendance: Attendance, reason?: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await saveJournal(lesson.lessonId, {
        version: Number(lesson.version),
        rows: [{ studentId: row.studentId, grade, attendance, ...(reason === undefined ? {} : { reason }) }],
      });
      setCurrentLessons(previous => previous.map(item => item.lessonId !== lesson.lessonId ? item : {
        ...item,
        version: Number(item.version) + 1,
        rows: item.rows.map(entry => entry.studentId !== row.studentId ? entry : {
          ...entry,
          grade,
          attendance,
          ...(reason === undefined ? {} : { correctionReason: reason.trim() }),
        }),
      }));
      setNotice(grade !== row.grade
        ? isDean && row.grade !== null ? "Оценка исправлена. Студент получит уведомление." : "Оценка выставлена. Студент получит уведомление."
        : "Посещаемость сохранена.");
      setCorrection(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setError("Журнал изменился. Загружаем актуальные данные…");
        reload();
      } else if (cause instanceof ApiError && cause.status === 403) {
        setError("Оценку уже выставили. Исправить её может декан.");
      } else {
        setError("Не удалось сохранить изменения. Попробуйте ещё раз.");
      }
    } finally {
      setBusy(false);
    }
  }

  const attendanceLabel = (attendance: Attendance) => attendance === "present" ? "Был" : attendance === "absent" ? "Не был" : "—";

  return <>
    <section className="academic-panel journal-matrix-panel" aria-label="Оценки по занятиям">
      <h2>Оценки и посещаемость</h2>
      {error && <p role="alert">{error}</p>}
      {notice && <p className="performance-save-success" role="status">{notice}</p>}
      <div className="journal-matrix-scroll" tabIndex={0} aria-label="Таблица оценок; прокручивается по горизонтали">
        <table className="journal-matrix" aria-label="Оценки по занятиям">
          <thead><tr>
            <th scope="col">Студент</th>
            {ordered.map(lesson => <th scope="col" key={lesson.lessonId}>
              <span>{formatDay(dateKey(new Date(lesson.startsAt)), { day: "2-digit", month: "2-digit" })}</span>
              <small>{formatTime(lesson.startsAt)} · {lesson.subject}</small>
              {lesson.readOnlyReason && <small className="journal-readonly-note">{lesson.readOnlyReason}</small>}
              {lesson.isCancelled && !lesson.readOnlyReason && <small>Отменено</small>}
            </th>)}
          </tr></thead>
          <tbody>
            {students.map(student => <tr key={student.studentId}>
              <th scope="row">{student.fullName}</th>
              {ordered.map(lesson => {
                const row = lesson.rows.find(item => item.studentId === student.studentId) ?? student;
                const grade = row.grade === null ? null : Number(row.grade);
                const day = formatDay(dateKey(new Date(lesson.startsAt)), { day: "2-digit", month: "2-digit" });
                const canEdit = lesson.canEdit && !busy;
                return <td key={lesson.lessonId}>
                  <div className="journal-matrix-cell">
                    {canTeach && grade === null && canEdit
                      ? <select aria-label={`Оценка ${row.fullName}, ${day}`} value="" onChange={event => void saveCell(lesson, row, Number(event.target.value), row.attendance)}>
                        <option value="" disabled>Выбрать</option>{[2, 3, 4, 5].map(value => <option key={value} value={value}>{value}</option>)}
                      </select>
                      : isDean && grade === null && canEdit
                        ? <select aria-label={`Выставить оценку ${row.fullName}, ${day}`} value="" onChange={event => void saveCell(lesson, row, Number(event.target.value), row.attendance)}>
                          <option value="" disabled>Выбрать</option>{[2, 3, 4, 5].map(value => <option key={value} value={value}>{value}</option>)}
                        </select>
                      : isDean && grade !== null && canEdit
                        ? <Button type="button" variant="outline" className="journal-grade-button" aria-label={`Исправить оценку ${row.fullName}, ${day}: ${grade}`} onClick={() => setCorrection({ lesson, row, grade: String(grade), reason: "" })}>{grade}</Button>
                        : grade === null ? <span className="journal-grade-empty">—</span> : <strong className="journal-grade-value">{grade}</strong>}
                    {row.correctionReason && <small className="journal-correction-note" title={`Причина последнего исправления: ${row.correctionReason}`}>Исправлена</small>}
                    {canTeach && canEdit
                      ? <select aria-label={`Посещаемость ${row.fullName}, ${day}`} value={row.attendance} onChange={event => void saveCell(lesson, row, grade, event.target.value as Attendance)}>
                        <option value="unmarked">Не указано</option><option value="present">Был</option><option value="absent">Не был</option>
                      </select>
                      : <span className="journal-attendance-value">{attendanceLabel(row.attendance)}</span>}
                  </div>
                </td>;
              })}
            </tr>)}
          </tbody>
        </table>
      </div>
      {!students.length && <p>В группе пока нет студентов.</p>}
    </section>

    <dialog ref={dialog} className="journal-correction-dialog" aria-labelledby="journal-correction-title"
      onCancel={event => { event.preventDefault(); setCorrection(null); }} onClose={() => setCorrection(null)}>
      {correction && <form onSubmit={event => {
        event.preventDefault();
        if (!correction.reason.trim()) return;
        void saveCell(correction.lesson, correction.row, Number(correction.grade), correction.row.attendance, correction.reason);
      }}>
        <h2 id="journal-correction-title">Исправить оценку</h2>
        <p>{correction.row.fullName} · {courseName} · {formatDay(dateKey(new Date(correction.lesson.startsAt)), { day: "numeric", month: "long", year: "numeric" })}</p>
        <SelectField id="journal-correction-grade" label="Новая оценка" value={correction.grade} onChange={event => setCorrection({ ...correction, grade: event.target.value })}>
          {[2, 3, 4, 5].map(value => <option key={value} value={value}>{value}</option>)}
        </SelectField>
        <label className="journal-correction-reason" htmlFor="journal-correction-reason">Причина исправления
          <textarea id="journal-correction-reason" required minLength={1} maxLength={1000} value={correction.reason} onChange={event => setCorrection({ ...correction, reason: event.target.value })} />
        </label>
        <div className="journal-correction-actions">
          <Button type="button" variant="outline" onClick={() => setCorrection(null)}>Отмена</Button>
          <Button type="submit" variant="primary" disabled={busy || !correction.reason.trim() || Number(correction.grade) === correction.row.grade}>{busy ? "Сохраняем…" : "Сохранить исправление"}</Button>
        </div>
      </form>}
    </dialog>
  </>;
}
