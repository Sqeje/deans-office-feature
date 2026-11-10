import { useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { loadPerformance, loadSemesters } from "./api";
import { RequestFailure, useRemote } from "./remote";
import { SelectField, Skeleton } from "../../components/ui/primitives";
import { EmptyState } from "../../shared/states";
import "./performance.css";

export function AcademicSummary() {
  const [params, setParams] = useSearchParams();
  const catalog = useRemote("semesters", loadSemesters);
  const semesterId =
    params.get("semester") ?? catalog.data?.defaultSemesterId ?? "";
  const semester = catalog.data?.semesters.find((s) => s.id === semesterId);
  const load = useCallback(
    (signal: AbortSignal) => loadPerformance(semesterId, signal),
    [semesterId],
  );
  const result = useRemote(semester ? semesterId : "", load);
  const summary = result.data?.summary;
  return (
    <section
      className="performance-home"
      aria-labelledby="performance-summary-title"
    >
      <h2 id="performance-summary-title">Успеваемость</h2>
      {catalog.error ? (
        <RequestFailure error={catalog.error} retry={catalog.retry} />
      ) : !catalog.data ? (
        <Skeleton />
      ) : !catalog.data.semesters.length ? (
        <EmptyState
          title="Семестров пока нет"
          text="Учебные данные ещё не добавлены."
        />
      ) : (
        <>
          <SelectField
            id="summary-semester"
            label="Семестр"
            value={semester ? semesterId : ""}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              next.set("semester", e.target.value);
              setParams(next);
            }}
          >
            {!semester && (
              <option value="" disabled>
                Выберите семестр
              </option>
            )}
            {catalog.data.semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </SelectField>
          {!semester ? (
            <p>Выберите доступный семестр.</p>
          ) : result.error ? (
            <RequestFailure error={result.error} retry={result.retry} />
          ) : !summary ? (
            <Skeleton />
          ) : (
            <>
              {summary.total === 0 ? (
                <p>Дисциплин пока нет.</p>
              ) : (
                <div className="performance-summary-body">
                  {summary.average !== null && (
                    <svg
                      className="performance-average-ring"
                      viewBox="0 0 88 88"
                      role="img"
                      aria-label={
                        "Средний балл " +
                        new Intl.NumberFormat("ru-RU", {
                          maximumFractionDigits: 2,
                        }).format(summary.average) +
                        " из 5"
                      }
                    >
                      <circle
                        cx="44"
                        cy="44"
                        r="38"
                        className="performance-ring-track"
                      />
                      <circle
                        cx="44"
                        cy="44"
                        r="38"
                        className="performance-ring-value"
                        strokeDasharray={`${(summary.average / 5) * 239} 239`}
                        transform="rotate(-90 44 44)"
                      />
                      <text
                        x="44"
                        y="42"
                        textAnchor="middle"
                        className="performance-ring-number"
                      >
                        {new Intl.NumberFormat("ru-RU", {
                          maximumFractionDigits: 1,
                        }).format(summary.average)}
                      </text>
                      <text
                        x="44"
                        y="59"
                        textAnchor="middle"
                        className="performance-ring-label"
                      >
                        из 5,0
                      </text>
                    </svg>
                  )}
                  <dl className="performance-summary-values">
                    <div>
                      <dt>Сдано дисциплин</dt>
                      <dd>
                        {summary.passed} из {summary.total}
                      </dd>
                    </div>
                    <div>
                      <dt>Средний балл</dt>
                      <dd>
                        {summary.average === null
                          ? "Оценок пока нет"
                          : new Intl.NumberFormat("ru-RU", {
                              maximumFractionDigits: 2,
                            }).format(summary.average)}
                      </dd>
                    </div>
                    <div>
                      <dt>Задолженности</dt>
                      <dd>{summary.debts}</dd>
                    </div>
                  </dl>
                </div>
              )}
              <Link
                className="academic-all-link"
                to={
                  "/student/academic-performance?semester=" +
                  encodeURIComponent(semesterId)
                }
              >
                Открыть успеваемость
              </Link>
            </>
          )}
        </>
      )}
    </section>
  );
}
