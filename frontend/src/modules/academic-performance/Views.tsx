import { useEffect, useState } from "react";
import { loadStudentPoints, type StudentPoints } from "./api";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/ui/primitives";
import {
  finalLabel,
  formatDate,
  resultPresentation,
  type Discipline,
} from "./model";
import { Icon } from "./Icon";
export function Result({ discipline: d }: { discipline: Discipline }) {
  return (
    <StatusBadge tone={resultPresentation[d.status].tone}>
      {d.final === null ? "Итог ещё не выставлен" : `${d.assessment === "exam" ? "Экзамен" : "Зачёт"}: ${finalLabel(d.final)}`}{d.status === "debt" && " · Задолженность"}
    </StatusBadge>
  );
}
function AccumulatedPoints({ courseId }: { courseId: string }) {
  const [points, setPoints] = useState<StudentPoints>();
  useEffect(() => {
    const controller = new AbortController();
    setPoints(undefined);
    loadStudentPoints(courseId, controller.signal).then(value => { if (!controller.signal.aborted) setPoints(value); }).catch(() => {});
    return () => controller.abort();
  }, [courseId]);
  return points?.components.length ? <small className="academic-course-points">Набрано {points.earned} из {points.maximum} баллов</small> : null;
}
export function ResultsTable({
  disciplines,
  href,
}: {
  disciplines: readonly Discipline[];
  href: (id: string) => string;
}) {
  return (
    <div
      className="academic-table"
      role="table"
      aria-label="Результаты дисциплин"
    >
      <div role="row" className="academic-table-head">
        <span role="columnheader">Дисциплина</span>
        <span role="columnheader">Аттестация</span>
        <span role="columnheader">Результат</span>
        <span />
      </div>
      {disciplines.map((d) => (
        <div role="row" key={d.id}>
          <Link
            className="academic-table-row"
            to={href(d.id)}
            aria-label={"Открыть дисциплину: " + d.name}
          >
            <span role="cell"><strong>{d.name}</strong><AccumulatedPoints key={d.id} courseId={d.id} /></span>
            <span role="cell" className="academic-assessment">
              {d.assessment === "exam" ? "Экзамен" : "Зачёт"}
            </span>
            <span role="cell">
              <Result discipline={d} />
            </span>
            <Icon name="arrow" />
          </Link>
        </div>
      ))}
    </div>
  );
}
export function Overview({
  disciplines,
  summary,
  href,
  allHref,
}: {
  disciplines: readonly Discipline[];
  summary?: import("./model").PerformanceSummary;
  href: (id: string) => string;
  allHref: string;
}) {
  const credits =
    summary?.credits ??
    disciplines.filter((d) => d.final?.kind === "credit").length;
  const stats = [
    ["layers", "Дисциплины", summary?.total ?? disciplines.length],
    ["check", "Зачёты", credits],
    [
      "alert",
      "Задолженности",
      summary?.debts ?? disciplines.filter((d) => d.debt).length,
    ],
  ];
  return (
    <>
      <div className="academic-stats">
        {stats.map(([icon, label, value]) => (
          <div className="academic-stat" key={label}>
            <span className="academic-icon">
              <Icon name={String(icon)} />
            </span>
            <div>
              <h2>{label}</h2>
              <strong>{value}</strong>
            </div>
          </div>
        ))}
      </div>
      {summary && (
        <p className="academic-results-summary">
          Сдано дисциплин: {summary.passed} · Средняя итоговая оценка (2–5):{" "}
          {summary.average === null
            ? "Оценок пока нет"
            : new Intl.NumberFormat("ru-RU", {
                maximumFractionDigits: 2,
              }).format(summary.average)}
        </p>
      )}
      <div className="academic-overview-grid">
        <section className="academic-panel">
          <h2>Дисциплины</h2>
          <ResultsTable disciplines={disciplines} href={href} />
        </section>
        <section className="academic-panel academic-session">
          <h2>Сессия</h2>
          <div>
            {disciplines
              .filter(
                (d) =>
                  (d.examDate || d.assessmentDate) && d.status === "pending",
              )
              .map((d) => (
                <Link
                  className="academic-session-row"
                  key={d.id}
                  to={href(d.id)}
                >
                  <span className="academic-icon">
                    <Icon name="calendar" />
                  </span>
                  <span>
                    <strong>{d.name}</strong>
                    <span>
                      {d.assessment === "exam" ? "Экзамен" : "Зачёт"} ·{" "}
                      {formatDate((d.examDate ?? d.assessmentDate)!)}
                    </span>
                  </span>
                </Link>
              ))}
          </div>
          {!disciplines.some(
            (d) => (d.examDate || d.assessmentDate) && d.status === "pending",
          ) && <p className="muted">Даты сессии пока не назначены.</p>}
          <Link className="academic-all-link" to={allHref}>
            Все результаты
            <Icon name="arrow" />
          </Link>
        </section>
      </div>
    </>
  );
}
export function AllResults({
  disciplines,
  href,
  filter,
  onFilter,
}: {
  disciplines: readonly Discipline[];
  href: (id: string) => string;
  filter: string;
  onFilter: (value: string) => void;
}) {
  const shown = disciplines.filter(
    (d) => filter === "all" || d.status === filter,
  );
  return (
    <>
      <label className="academic-result-filter">
        <span className="sr-only">Фильтр результатов</span>
        <select value={filter} onChange={(e) => onFilter(e.target.value)}>
          <option value="all">Все результаты</option>
          <option value="passed">Сдано</option>
          <option value="pending">Не выставлены</option>
          <option value="debt">Задолженности</option>
        </select>
      </label>
      <section className="academic-panel academic-results">
        <ResultsTable disciplines={shown} href={href} />
        {!shown.length && (
          <p className="muted">Нет результатов с таким статусом.</p>
        )}
      </section>
      <p className="academic-results-summary">
        {countLabel(disciplines.length, [
          "дисциплина",
          "дисциплины",
          "дисциплин",
        ])}{" "}
        ·{" "}
        {countLabel(
          disciplines.filter((d) => d.final?.kind === "credit").length,
          ["зачёт", "зачёта", "зачётов"],
        )}{" "}
        ·{" "}
        {countLabel(disciplines.filter((d) => d.debt).length, [
          "задолженность",
          "задолженности",
          "задолженностей",
        ])}
      </p>
    </>
  );
}
function countLabel(count: number, forms: [string, string, string]) {
  const category = new Intl.PluralRules("ru-RU").select(count);
  return (
    count + " " + forms[category === "one" ? 0 : category === "few" ? 1 : 2]
  );
}
