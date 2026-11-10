import { useCallback, useState } from "react";
import { Button } from "../../components/ui/button";
import { SelectField, Skeleton } from "../../components/ui/primitives";
import { EmptyState } from "../../shared/states";
import { ApiError } from "../../shared/api";
import {
  loadGroups,
  loadSemesters,
  loadStudents,
  loadStudentPerformance,
  saveResult,
  type ResultInput,
} from "./api";
import { RequestFailure, useRemote } from "./remote";
import { finalLabel, type Discipline } from "./model";
import "./performance.css";

export function StaffPage() {
  const groups = useRemote("groups", loadGroups);
  const catalog = useRemote("semesters", loadSemesters);
  const [groupId, setGroup] = useState("");
  const [studentId, setStudent] = useState("");
  const [term, setTerm] = useState<string | null>(null);
  const semesterId = term ?? catalog.data?.defaultSemesterId ?? "";
  const [courseId, setCourse] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<unknown>();
  const rosterLoad = useCallback(
    (signal: AbortSignal) => loadStudents(groupId, signal),
    [groupId],
  );
  const roster = useRemote(groupId, rosterLoad);
  const student = roster.data?.find((s) => s.id === studentId);
  const performanceLoad = useCallback(
    (signal: AbortSignal) =>
      loadStudentPerformance(studentId, semesterId, signal),
    [studentId, semesterId],
  );
  const performance = useRemote(
    student && semesterId ? studentId + "/" + semesterId : "",
    performanceLoad,
  );
  const discipline = performance.data?.disciplines.find(
    (d) => d.id === courseId,
  );
  function clearMessage() {
    setSaved(false);
    setSaveError(undefined);
  }
  async function save(body: ResultInput) {
    if (busy || !student || !discipline) return;
    setBusy(true);
    clearMessage();
    try {
      await saveResult(student.id, discipline.id, body);
      setSaved(true);
      performance.retry();
    } catch (error) {
      setSaveError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="performance-staff">
      <h1>Успеваемость</h1>
      <p className="muted">
        Внесите локальный итог студента назначенной группы. Текущие работы
        доступны для просмотра.
      </p>
      {groups.error ? (
        <RequestFailure
          error={groups.error}
          retry={groups.retry}
          title="Не удалось загрузить группы"
        />
      ) : catalog.error ? (
        <RequestFailure error={catalog.error} retry={catalog.retry} />
      ) : !groups.data || !catalog.data ? (
        <Skeleton />
      ) : !groups.data.length ? (
        <EmptyState
          title="Группы пока не назначены"
          text="Для внесения результатов требуется разрешение на группу."
        />
      ) : !catalog.data.semesters.length ? (
        <EmptyState
          title="Семестров пока нет"
          text="Учебные данные ещё не добавлены."
        />
      ) : (
        <>
          <fieldset className="performance-selection" disabled={busy}>
            <legend className="sr-only">Выбор студента и дисциплины</legend>
            <SelectField
              id="staff-group"
              label="Группа"
              value={groupId}
              onChange={(e) => {
                setGroup(e.target.value);
                setStudent("");
                setCourse("");
                clearMessage();
              }}
            >
              <option value="">Выберите группу</option>
              {groups.data.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="staff-semester"
              label="Семестр"
              value={semesterId}
              onChange={(e) => {
                setTerm(e.target.value);
                setCourse("");
                clearMessage();
              }}
            >
              {catalog.data.semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </SelectField>
            {groupId &&
              (roster.error ? (
                <RequestFailure
                  error={roster.error}
                  retry={roster.retry}
                  title="Не удалось загрузить студентов"
                />
              ) : !roster.data ? (
                <Skeleton />
              ) : !roster.data.length ? (
                <p>В этой группе пока нет студентов.</p>
              ) : (
                <SelectField
                  id="staff-student"
                  label="Студент"
                  value={studentId}
                  onChange={(e) => {
                    setStudent(e.target.value);
                    setCourse("");
                    clearMessage();
                  }}
                >
                  <option value="">Выберите студента</option>
                  {roster.data.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </SelectField>
              ))}
            {student &&
              (performance.error ? (
                <RequestFailure
                  error={performance.error}
                  retry={performance.retry}
                />
              ) : !performance.data ? (
                <Skeleton />
              ) : !performance.data.disciplines.length ? (
                <p>В этом семестре у группы пока нет дисциплин.</p>
              ) : (
                <SelectField
                  id="staff-course"
                  label="Дисциплина"
                  value={courseId}
                  onChange={(e) => {
                    setCourse(e.target.value);
                    clearMessage();
                  }}
                >
                  <option value="">Выберите дисциплину</option>
                  {performance.data.disciplines.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </SelectField>
              ))}
          </fieldset>
        {student && <p className="muted">Студент: {student.name}</p>}
        {saved && (
            <p className="performance-save-success" role="status">
              Результат сохранён. Студент увидит его в разделе успеваемости и на
              главной после обновления страницы.
            </p>
          )}
          {saveError instanceof ApiError &&
          (saveError.status === 401 || saveError.status === 403) ? (
            <RequestFailure error={saveError} retry={performance.retry} />
          ) : null}
          {saveError instanceof ApiError && saveError.status === 409 && (
            <Button
              variant="outline"
              onClick={() => {
                clearMessage();
                performance.retry();
              }}
            >
              Обновить результаты
            </Button>
          )}
          {discipline && (
            <ResultEditor
              key={studentId + "/" + semesterId + "/" + discipline.id}
              discipline={discipline}
              busy={busy}
              onSave={save}
              error={saveError}
            />
          )}
        </>
      )}
    </div>
  );
}

function ResultEditor({
  discipline,
  busy,
  onSave,
  error,
}: {
  discipline: Discipline;
  busy: boolean;
  onSave: (body: ResultInput) => Promise<void>;
  error: unknown;
}) {
  const initial =
    discipline.final?.kind === "grade"
      ? String(discipline.final.value)
      : (discipline.final?.kind ?? "pending");
  const [value, setValue] = useState(initial);
  const isLocal = discipline.isLocal !== false;
  const message = error
    ? error instanceof ApiError && error.status === 400
      ? "Проверьте итог: экзамен — оценка от 2 до 5, зачёт — зачтено или не зачтено."
      : error instanceof ApiError && error.status === 409
        ? "Результат изменился или принадлежит внешнему источнику. Обновите данные перед повтором."
        : "Не удалось сохранить результат. Попробуйте ещё раз."
    : undefined;
  return (
    <form
      className="academic-panel performance-result-form"
      onSubmit={(e) => {
        e.preventDefault();
        const kind =
          value === "pending" || value === "credit" || value === "failed-credit"
            ? value
            : "grade";
        void onSave({ kind, value: kind === "grade" ? Number(value) : null });
      }}
    >
      <h2>{discipline.name}</h2>
      <p>
        Текущий итог: <strong>{finalLabel(discipline.final)}</strong>
      </p>
      {discipline.grades.length > 0 && (
        <p>
          Текущие оценки: {discipline.grades.map((g) => g.value).join(", ")}
        </p>
      )}
      <SelectField
        id="staff-result"
        label="Итоговый результат"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy || !isLocal}
        aria-invalid={!!message}
        aria-describedby={message ? "result-error" : undefined}
      >
        <option value="pending">Не выставлен</option>
        {discipline.assessment === "exam" ? (
          [2, 3, 4, 5].map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))
        ) : (
          <>
            <option value="credit">Зачтено</option>
            <option value="failed-credit">Не зачтено</option>
          </>
        )}
      </SelectField>
      {!isLocal && (
        <p>
          Результат получен из внешнего источника и недоступен для ручного
          изменения.
        </p>
      )}
      {message && (
        <p id="result-error" role="alert">
          {message}
        </p>
      )}
      <Button variant="primary" disabled={busy || !isLocal} type="submit">
        {busy ? "Сохраняем…" : "Сохранить результат"}
      </Button>
    </form>
  );
}
