import { Icon } from "./Icon";
import { Result } from "./Views";
import { formatDate, type Discipline } from "./model";
import { useEffect, useState } from "react";
import { ApiError } from "../../shared/api";
import { loadStudentPoints, type StudentPoints } from "./api";
import { InlineError } from "../../shared/states";
export function DisciplinePage({ discipline: d }: { discipline: Discipline }) {
  const [points, setPoints] = useState<StudentPoints>();
  const [pointsError, setPointsError] = useState<unknown>();
  const [pointsMissing, setPointsMissing] = useState(false);
  const [pointsAttempt, setPointsAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setPoints(undefined); setPointsError(undefined); setPointsMissing(false);
    loadStudentPoints(d.id, controller.signal).then(setPoints).catch(error => { if (!controller.signal.aborted) { if (error instanceof ApiError && error.status === 404) setPointsMissing(true); else setPointsError(error); } });
    return () => controller.abort();
  }, [d.id, pointsAttempt]);
  return (
    <>
      <section className="academic-panel academic-points" aria-labelledby="points-title">
        <div className="academic-points-heading"><h2 id="points-title">Накопленные баллы</h2>{!!points?.components.length && <strong>Набрано {points.earned} из {points.maximum}</strong>}</div>
        {pointsError ? <InlineError message={pointsError instanceof ApiError && pointsError.status === 403 ? "Нет доступа к балльному плану. Обратитесь к сотруднику деканата." : "Не удалось загрузить балльный план. Проверьте соединение и повторите попытку."} traceId={pointsError instanceof ApiError ? pointsError.traceId : undefined} onRetry={pointsError instanceof ApiError && pointsError.status === 403 ? undefined : () => setPointsAttempt(value => value + 1)} /> : pointsMissing ? <p className="muted">Балльный план для этой дисциплины пока недоступен.</p> : !points ? <p className="muted" role="status">Загружаем баллы…</p> : points.components.length === 0 ? <p className="muted">Балльный план ещё не опубликован.</p> : <>
          <progress className="academic-score-progress" aria-label="Накопленные баллы" value={points.earned} max={points.maximum} />
          <p className="muted">Баллы за выполненные работы и посещение. Невыставленные результаты ещё не входят в сумму.</p>
          <ul>{points.components.map(component => <li key={component.id}><span>{component.name}{component.incomplete && <small> · Есть неотмеченные занятия</small>}</span><strong>{component.points === null ? `Не выставлено · из ${component.maximum}` : `${component.points} из ${component.maximum}`}</strong></li>)}</ul>
          {points.attendanceIncomplete && <p className="muted">Баллы за посещение предварительные: журнал заполнен не полностью.</p>}
          <details className="academic-scoring-rules">
            <summary>Правила оценивания дисциплины</summary>
            <p>Преподаватель задаёт состав работ и максимум за каждую. Сумма максимумов — {points.maximum} баллов; разбивка указана выше.</p>
            {points.components.some(x => x.kind === "attendance") && <p>Посещение рассчитывается по журналу: доля присутствий среди отмеченных прошедших занятий × максимум за посещение. Пока журнал заполнен не полностью, результат предварительный.</p>}
            <p>Шкала перевода баллов в итоговую оценку пока не опубликована. Итог экзамена или зачёта преподаватель выставляет отдельно; автоматически из суммы баллов он не рассчитывается.</p>
          </details>
        </>}
      </section>
      <section
        className="academic-attestation"
        aria-label="Итоговая аттестация"
      >
        <span className="academic-icon">
          <Icon name="layers" />
        </span>
        <div>
          <p>Итоговая аттестация</p>
          <h2>{d.assessment === "credit" ? "Зачёт" : "Экзамен"}</h2>
        </div>
        <Result discipline={d} />
      </section>
      <div className="academic-discipline-grid">
        <section className="academic-panel">
          <h2>{points?.components.length ? "Как формируется итог" : "Оценки за отдельные работы"}</h2>
          {points?.components.length ? <p>Накопленные баллы и результаты работ показаны выше. Итог экзамена или зачёта указан в блоке «Итоговая аттестация». Его выставляет преподаватель отдельно от накопленных баллов.</p> : d.grades.length ? (
            <><p className="muted">Преподаватель выставил эти работы по пятибалльной шкале. Они не переводятся автоматически в накопленные баллы или итог аттестации.</p>
            <div
              className="academic-grades"
              role="table"
              aria-label="Текущие оценки"
            >
              <div
                className="academic-grades-row academic-table-head"
                role="row"
              >
                <span role="columnheader">Вид работы</span>
                <span role="columnheader">Дата</span>
                <span role="columnheader">Оценка</span>
              </div>
              {d.grades.map((g, i) => (
                <div className="academic-grades-row" role="row" key={g.id}>
                  <span role="cell" className="academic-work">
                    <span className="academic-icon">
                      <Icon name={["document", "code", "chat"][i % 3]} />
                    </span>
                    <strong>{g.activity}</strong>
                  </span>
                  <time role="cell" dateTime={g.date}>
                    {formatDate(g.date)}
                  </time>
                  <span
                    role="cell"
                    className={
                      g.value === 2
                        ? "academic-grade academic-grade-failed"
                        : "academic-grade"
                    }
                    aria-label={"Оценка " + g.value}
                  >
                    {g.value}
                  </span>
                </div>
              ))}
            </div></>
          ) : (
            <p className="muted">Оценок за отдельные работы пока нет.</p>
          )}
        </section>
        <section className="academic-panel academic-about">
          <h2>О дисциплине</h2>
          <div>
            <span className="academic-icon">
              <Icon name="user" />
            </span>
            <p>
              Преподаватель:<strong>{d.teacher ?? "Пока не указан"}</strong>
            </p>
          </div>
          <div>
            <span className="academic-icon">
              <Icon name="cap" />
            </span>
            <p>
              Форма аттестации:
              <strong>{d.assessment === "credit" ? "зачёт" : "экзамен"}</strong>
            </p>
          </div>
          {(d.examDate || d.assessmentDate) && (
            <div>
              <span className="academic-icon">
                <Icon name="calendar" />
              </span>
              <p>
                {d.assessment === "exam" ? "Дата экзамена:" : "Дата зачёта:"}
                <strong>{formatDate((d.examDate ?? d.assessmentDate)!)}</strong>
              </p>
            </div>
          )}
        </section>
      </div>
      {d.debt && (
        <section className="academic-panel" role="note">
          <h2>Задолженность</h2>
          <p>{d.debt.reason}</p>
        </section>
      )}
    </>
  );
}
