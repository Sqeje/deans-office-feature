import { useCallback, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SelectField, Skeleton } from "../../components/ui/primitives";
import { EmptyState } from "../../shared/states";
import { loadPerformance, loadSemesters } from "./api";
import { RequestFailure, useRemote } from "./remote";
import { Overview, AllResults } from "./Views";
import { DisciplinePage } from "./DisciplinePage";
import { Icon } from "./Icon";
import { type PerformanceLoader, type SemesterCatalog } from "./model";
import "./performance.css";

export function Page({
  loader = loadPerformance,
  catalogLoader = loadSemesters,
  demonstration = false,
}: {
  loader?: PerformanceLoader;
  catalogLoader?: (signal: AbortSignal) => Promise<SemesterCatalog>;
  demonstration?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const catalog = useRemote("semesters", catalogLoader);
  const semesters = catalog.data?.semesters ?? [];
  const semesterId =
    params.get("semester") ?? catalog.data?.defaultSemesterId ?? "";
  const semester = semesters.find((s) => s.id === semesterId);
  const disciplineId = params.get("discipline");
  const all = params.get("view") === "results";
  const filter = ["all", "passed", "pending", "debt"].includes(
    params.get("filter") ?? "all",
  )
    ? (params.get("filter") ?? "all")
    : "all";
  const load = useCallback(
    (signal: AbortSignal) => loader(semesterId, signal),
    [semesterId, loader],
  );
  const result = useRemote(semester ? semesterId : "", load);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [disciplineId, all]);
  const data = result.data;
  const selected = data?.disciplines.find((d) => d.id === disciplineId);
  const href = (id?: string) => {
    const next = new URLSearchParams(params);
    next.set("semester", semesterId);
    if (id) next.set("discipline", id);
    else next.delete("discipline");
    return "?" + next;
  };
  return (
    <div className="academic-page">
      {disciplineId && (
        <>
          <Link className="academic-back" to={"?semester=" + semesterId}>
            <Icon name="back" />
            Вернуться к успеваемости
          </Link>
          <nav className="academic-breadcrumb" aria-label="Хлебные крошки">
            <Link to={"?semester=" + semesterId}>Успеваемость</Link>
            <span>/</span>
            <span>{selected?.name ?? "Дисциплина"}</span>
          </nav>
        </>
      )}
      {all && !disciplineId && (
        <nav aria-label="Хлебные крошки" className="academic-breadcrumb">
          <Link to={"?semester=" + semesterId}>Успеваемость</Link>
          <span>/</span>
          <span>Все результаты</span>
        </nav>
      )}
      <header className="academic-page-header">
        <div>
          <h1 tabIndex={-1} ref={heading}>
            {disciplineId
              ? (selected?.name ?? "Дисциплина")
              : all
                ? "Все результаты"
                : "Успеваемость"}
          </h1>
          {!disciplineId && !all && <p>Оценки и результаты обучения</p>}
        </div>
        <SelectField
          id="performance-semester"
          label="Семестр"
          value={semester ? semesterId : ""}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set("semester", e.target.value);
            next.delete("discipline");
            setParams(next);
          }}
        >
          {!semester && (
            <option value="" disabled>
              Неизвестный семестр
            </option>
          )}
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </SelectField>
      </header>
      {catalog.error ? (
        <RequestFailure error={catalog.error} retry={catalog.retry} />
      ) : !catalog.data ? (
        <Skeleton />
      ) : !semesters.length ? (
        <EmptyState
          title="Семестров пока нет"
          text="Учебные данные ещё не добавлены."
        />
      ) : !semester ? (
        <EmptyState
          title="Семестр не найден"
          text="Выберите доступный семестр."
        />
      ) : result.error ? (
        <RequestFailure error={result.error} retry={result.retry} />
      ) : !data ? (
        <Skeleton />
      ) : (
        data && (
          <>
            <span className="sr-only" role="status">
              Загружено дисциплин: {data.disciplines.length}
            </span>
            {disciplineId ? (
              selected ? (
                <DisciplinePage discipline={selected} />
              ) : (
                <EmptyState
                  title="Дисциплина не найдена"
                  text="Выберите дисциплину в этом семестре."
                />
              )
            ) : all ? (
              <AllResults
                disciplines={data.disciplines}
                href={href}
                filter={filter}
                onFilter={(value) => {
                  const next = new URLSearchParams(params);
                  next.set("filter", value);
                  setParams(next);
                }}
              />
            ) : data.disciplines.length ? (
              <Overview
                disciplines={data.disciplines}
                summary={data.summary}
                href={href}
                allHref={"?semester=" + semesterId + "&view=results"}
              />
            ) : (
              <EmptyState
                title="Дисциплин пока нет"
                text="Выберите другой семестр."
              />
            )}
          </>
        )
      )}
      {demonstration && (
        <p className="academic-demo-note">
          Учебные примеры, не персональные результаты.
        </p>
      )}
    </div>
  );
}
