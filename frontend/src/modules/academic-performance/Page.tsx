import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import {
  SectionCard,
  SelectField,
  Skeleton,
  StatusBadge,
} from "../../components/ui/primitives";
import { EmptyState } from "../../shared/states";
import { defaultSemesterId, loadDemoPerformance, semesters } from "./demo";
import {
  finalLabel,
  formatDate,
  resultPresentation,
  summarize,
  type Discipline,
  type PerformanceLoader,
  type SemesterPerformance,
} from "./model";
import "./performance.css";

type LoadState = { semesterId: string; attempt: number } & (
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; data: SemesterPerformance }
);

function DisciplineDetails({ discipline }: { discipline: Discipline }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [discipline.id]);
  const presentation = resultPresentation[discipline.status];
  return (
    <section
      className="section-card discipline-details"
      aria-labelledby="discipline-heading"
    >
      <div className="performance-heading-row">
        <h2 id="discipline-heading" ref={heading} tabIndex={-1}>
          {discipline.name}
        </h2>
        <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>
      </div>
      <dl className="discipline-facts">
        <div>
          <dt>Форма аттестации</dt>
          <dd>{discipline.assessment === "exam" ? "Экзамен" : "Зачёт"}</dd>
        </div>
        <div>
          <dt>Итоговый результат</dt>
          <dd>{finalLabel(discipline.final)}</dd>
        </div>
        <div>
          <dt>Задолженность</dt>
          <dd>
            {discipline.debt ? discipline.debt.reason : "Задолженности нет"}
          </dd>
        </div>
        <div>
          <dt>Дата экзамена</dt>
          <dd>
            {discipline.examDate ? (
              <time dateTime={discipline.examDate}>
                {formatDate(discipline.examDate)}
              </time>
            ) : discipline.assessment === "credit" ? (
              "Экзамен не предусмотрен"
            ) : (
              "Дата пока не назначена"
            )}
          </dd>
        </div>
      </dl>
      <h3>Текущие оценки</h3>
      {discipline.grades.length ? (
        <ul className="current-grades">
          {discipline.grades.map((grade) => (
            <li key={grade.id}>
              <div>
                <strong>{grade.activity}</strong>
                <time dateTime={grade.date}>{formatDate(grade.date)}</time>
              </div>
              <span
                className="grade-value"
                aria-label={"Оценка " + grade.value}
              >
                {grade.value}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Текущих оценок пока нет.</p>
      )}
    </section>
  );
}

export function Page({
  loader = loadDemoPerformance,
}: {
  loader?: PerformanceLoader;
}) {
  const [params, setParams] = useSearchParams();
  const semesterId = params.get("semester") ?? defaultSemesterId;
  const disciplineId = params.get("discipline");
  const semester = semesters.find((item) => item.id === semesterId);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({
    status: "loading",
    semesterId,
    attempt,
  });
  useEffect(() => {
    if (!semester) return;
    const controller = new AbortController();
    setState({ status: "loading", semesterId, attempt });
    void Promise.resolve()
      .then(() => loader(semesterId, controller.signal))
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ status: "success", semesterId, attempt, data });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ status: "error", semesterId, attempt });
      });
    return () => controller.abort();
  }, [semesterId, semester, loader, attempt]);

  function chooseSemester(value: string) {
    const next = new URLSearchParams(params);
    next.set("semester", value);
    next.delete("discipline");
    setParams(next);
  }
  const data =
    state.status === "success" &&
    state.semesterId === semesterId &&
    state.attempt === attempt
      ? state.data
      : null;
  const summary = data ? summarize(data.disciplines) : null;
  const selected = data?.disciplines.find((item) => item.id === disciplineId);

  return (
    <div className="performance-page">
      <header className="performance-page-header">
        <h1>Успеваемость</h1>
        <p className="muted">Результаты учёбы и даты сессии</p>
      </header>
      <p className="demo-notice">
        Демонстрационные данные. Учебные примеры одинаковы для всех студентов и
        не являются вашими результатами.
      </p>
      <SelectField
        id="performance-semester"
        label="Семестр"
        value={semester ? semesterId : ""}
        onChange={(event) => chooseSemester(event.target.value)}
      >
        {!semester && (
          <option value="" disabled>
            Неизвестный семестр
          </option>
        )}
        {semesters.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </SelectField>
      {!semester ? (
        <EmptyState
          title="Семестр не найден"
          text="Выберите доступный семестр в списке выше."
        />
      ) : state.semesterId !== semesterId ||
        state.attempt !== attempt ||
        state.status === "loading" ? (
        <Skeleton />
      ) : state.status === "error" ? (
        <section className="section-card" role="alert">
          <h2>Не удалось загрузить успеваемость</h2>
          <p className="muted">
            Попробуйте ещё раз или выберите другой семестр.
          </p>
          <Button
            variant="primary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Повторить
          </Button>
        </section>
      ) : (
        data &&
        summary && (
          <>
            <p className="sr-only" role="status">
              {semester.label}: загружено дисциплин — {data.disciplines.length}.
            </p>
            <dl className="performance-summary" aria-label="Сводка за семестр">
              <div>
                <dt>Сдано дисциплин</dt>
                <dd>
                  {summary.passed} из {data.disciplines.length}
                </dd>
              </div>
              <div>
                <dt>Задолженности</dt>
                <dd>{summary.debts}</dd>
              </div>
              <div>
                <dt>Средний итоговый балл</dt>
                <dd>
                  {summary.average === null
                    ? "Оценок пока нет"
                    : new Intl.NumberFormat("ru-RU", {
                        maximumFractionDigits: 1,
                        minimumFractionDigits: 1,
                      }).format(summary.average) + " из 5"}
                </dd>
              </div>
            </dl>
            <p className="summary-note muted">
              Среднее учитывает числовые итоговые оценки, включая двойки. Зачёты
              не учитываются.
            </p>
            {data.disciplines.length ? (
              <SectionCard title="Дисциплины">
                <ul className="discipline-list">
                  {data.disciplines.map((discipline) => {
                    const next = new URLSearchParams(params);
                    next.set("semester", semesterId);
                    next.set("discipline", discipline.id);
                    const presentation = resultPresentation[discipline.status];
                    return (
                      <li key={discipline.id}>
                        <Link
                          to={"?" + next}
                          className="discipline-link"
                          aria-current={
                            discipline.id === disciplineId ? "true" : undefined
                          }
                        >
                          <span className="discipline-name">
                            {discipline.name}
                            <span className="discipline-meta">
                              {discipline.assessment === "exam"
                                ? "Экзамен"
                                : "Зачёт"}
                              {discipline.examDate &&
                                " · " + formatDate(discipline.examDate)}
                            </span>
                          </span>
                          <span className="discipline-result">
                            <span className="final-result">
                              Итог: {finalLabel(discipline.final)}
                            </span>
                            <StatusBadge tone={presentation.tone}>
                              {presentation.label}
                            </StatusBadge>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            ) : (
              <EmptyState
                title="Дисциплин пока нет"
                text="Для этого семестра результаты ещё не добавлены. Выберите другой семестр."
              />
            )}
            {disciplineId &&
              (selected ? (
                <DisciplineDetails
                  key={semesterId + "/" + selected.id}
                  discipline={selected}
                />
              ) : (
                <EmptyState
                  title="Дисциплина не найдена"
                  text="В этом семестре такой дисциплины нет. Выберите её из списка выше."
                />
              ))}
          </>
        )
      )}
    </div>
  );
}
