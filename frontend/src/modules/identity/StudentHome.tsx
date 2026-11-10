import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { CalendarDays, Clock3, FileText, Bell, ArrowRight } from "lucide-react";
import { api, ApiError, type Profile } from "../../shared/api";
import { useSession } from "../../shared/session";
import { homeDemo, type HomeDemoSnapshot } from "./homeDemo";
export type Block<T> =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "success"; data: T | null };
export function SummaryCard<T>({
  title,
  block,
  empty,
  children,
  className = "",
}: {
  title: string;
  block: Block<T>;
  empty: string;
  children: (data: T) => ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <h2>{title}</h2>
      {block.status === "loading" ? (
        <p role="status" className="skeleton">
          Загружаем данные…
        </p>
      ) : block.status === "error" ? (
        <div role="alert">
          <p>Не удалось загрузить данные.</p>
          <button className="text-button" onClick={block.retry}>
            Повторить
          </button>
        </div>
      ) : block.data === null ? (
        <p className="muted">{empty}</p>
      ) : (
        children(block.data)
      )}
    </section>
  );
}
export type SummaryBlocks = {
  [K in
    | "lesson"
    | "event"
    | "performance"
    | "request"
    | "notifications"]?: Block<NonNullable<HomeDemoSnapshot[K]>>;
};
export function HomeSummaries({
  data,
  blocks,
}: {
  data: HomeDemoSnapshot;
  blocks?: SummaryBlocks;
}) {
  const date = (v: string) =>
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: data.timeZone,
      day: "numeric",
      month: "long",
    }).format(new Date(v.length === 10 ? v + "T12:00:00+03:00" : v));
  const time = (v: string) =>
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: data.timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(v));
  const success = <T,>(value: T | null): Block<T> => ({
    status: "success",
    data: value,
  });
  return (
    <>
      <aside className="demo-notice">
        Демонстрационные данные — не связаны с вашим учебным профилем.
        Демонстрация на {date(data.asOf)}.
      </aside>
      <div className="home-grid">
        <SummaryCard
          title="Ближайшее занятие"
          block={blocks?.lesson ?? success(data.lesson)}
          empty="Сегодня занятий нет"
          className="lesson-card"
        >
          {(lesson) => (
            <>
              <Clock3 className="hero-icon" aria-hidden="true" />
              <p className="lesson-title">
                {time(lesson.startsAt)} · {lesson.title}
              </p>
              <p>{lesson.room}</p>
              <Link to="/student/schedule">
                Перейти в расписание <ArrowRight aria-hidden="true" />
              </Link>
            </>
          )}
        </SummaryCard>
        <SummaryCard
          title="Важное событие"
          block={blocks?.event ?? success(data.event)}
          empty="Важных событий пока нет"
          className="event-card"
        >
          {(event) => (
            <div className="summary-row">
              <CalendarDays aria-hidden="true" />
              <div>
                <h3>{event.title}</h3>
                <p>До {date(event.deadline)}</p>
              </div>
            </div>
          )}
        </SummaryCard>
        <SummaryCard
          title="Успеваемость"
          block={blocks?.performance ?? success(data.performance)}
          empty="Оценок пока нет"
        >
          {(grades) => (
            <>
              <div className="summary-row">
                <div
                  className="progress-ring"
                  role="img"
                  aria-label={`Средний балл ${grades.average.toLocaleString("ru-RU")} из ${grades.maximum}`}
                  style={{
                    background: `conic-gradient(var(--color-primary) ${(grades.average / grades.maximum) * 360}deg, var(--color-border) 0)`,
                  }}
                >
                  <span>
                    {grades.average.toLocaleString("ru-RU")}
                    <small>из {grades.maximum}</small>
                  </span>
                </div>
                <dl>
                  <dt>Сдано дисциплин</dt>
                  <dd>{grades.passed}</dd>
                  <dt>Средний балл</dt>
                  <dd>{grades.average.toLocaleString("ru-RU")}</dd>
                </dl>
              </div>
              <Link to="/student/academic-performance">
                Вся успеваемость <ArrowRight aria-hidden="true" />
              </Link>
            </>
          )}
        </SummaryCard>
        <SummaryCard
          title="Моя заявка"
          block={blocks?.request ?? success(data.request)}
          empty="Заявок пока нет"
        >
          {(request) => (
            <>
              <FileText className="summary-icon" aria-hidden="true" />
              <h3>{request.title}</h3>
              <p>
                <span className="status-badge">
                  {requestLabels[request.status]}
                </span>
              </p>
              <p className="muted">Подана {date(request.submittedAt)}</p>
              <Link to="/student/requests">
                Все заявки <ArrowRight aria-hidden="true" />
              </Link>
            </>
          )}
        </SummaryCard>
        <SummaryCard
          title="Последние уведомления"
          block={
            blocks?.notifications ??
            success(data.notifications.length ? data.notifications : null)
          }
          empty="Уведомлений пока нет"
          className="event-card"
        >
          {(items) => (
            <>
              <ul className="notification-list">
                {items.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Bell aria-hidden="true" />
                    <span>
                      {item.title}
                      {item.unread && <small>Не прочитано</small>}
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/student/notifications">
                Все уведомления <ArrowRight aria-hidden="true" />
              </Link>
            </>
          )}
        </SummaryCard>
      </div>
    </>
  );
}

const requestLabels = { in_review: "На рассмотрении" };
export function StudentHome() {
  const { session } = useSession();
  const [profile, setProfile] = useState<Profile | null>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setProfile(undefined);
    setError("");
    api
      .me()
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof ApiError && cause.status === 403
              ? "Нет доступа к профилю"
              : "Не удалось загрузить профиль",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (profile === null)
    return <Navigate to="/login" state={{ expired: true }} replace />;
  return (
    <>
      <h1 tabIndex={-1}>Здравствуйте, {session?.displayName}</h1>
      {error ? (
        <div role="alert">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => setAttempt(attempt + 1)}
          >
            Повторить
          </button>
        </div>
      ) : profile ? (
        <p className="muted">
          {profile.university} · Группа {profile.group}
        </p>
      ) : (
        <p role="status">Загружаем профиль…</p>
      )}
      <HomeSummaries data={homeDemo} />
    </>
  );
}
