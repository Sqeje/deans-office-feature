import { NotificationSummary } from "../notifications/Page";
import { RequestSummary } from '../requests/Summary';
import { requestStatuses, requestDetailsUrl } from "../requests/model";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { CalendarDays, FileText, Bell, ChevronRight } from "lucide-react";
import { api, ApiError, type Profile } from "../../shared/api";
import { useSession } from "../../shared/session";
import { PageHeader } from "../../components/ui/primitives";
import { InlineError } from "../../shared/states";
import { AcademicSummary } from "../academic-performance/Summary";
import { homeDemo, type HomeDemoSnapshot } from "./homeDemo";
import { useNextLesson } from "../schedule/NextLesson";
import { loadPerformance, loadSemesters } from "../academic-performance/api";
import { useRemote } from "../academic-performance/remote";
import "./StudentHome.css";
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
  action,
}: {
  title: string;
  block: Block<T>;
  empty: string;
  children: (data: T) => ReactNode;
  className?: string;
  action?: { to: string; label: string };
}) {
  return (
    <section className={`card ${className}`}>
      <div className="summary-heading">
        <h2>{title}</h2>
        {action && block.status === "success" && block.data !== null && (
          <Link
            className="summary-action"
            to={action.to}
            aria-label={action.label}
          >
            <ChevronRight aria-hidden="true" />
          </Link>
        )}
      </div>
      {block.status === "loading" ? (
        <p role="status" className="skeleton">
          Загружаем данные…
        </p>
      ) : block.status === "error" ? (
        <InlineError message="Не удалось загрузить данные." onRetry={block.retry} />
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
  livePerformance = false, liveRequests = false, liveNotifications = false,
}: {
  data: HomeDemoSnapshot;
  blocks?: SummaryBlocks;
  livePerformance?: boolean; liveRequests?: boolean; liveNotifications?: boolean;
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
  const demonstrationSections = [
    !blocks?.lesson && "ближайшее занятие",
    !blocks?.event && "важное событие",
    !livePerformance && "успеваемость",
    !liveRequests && "заявки",
    !liveNotifications && "уведомления",
  ].filter((section): section is string => !!section);
  return (
    <>
      {demonstrationSections.length > 0 && <aside className="demo-notice">
        Демонстрационные данные: {demonstrationSections.join(", ")}. Пример на {date(data.asOf)}.
      </aside>}
      <div className="home-grid">
        <SummaryCard
          title="Ближайшее занятие"
          block={blocks?.lesson ?? success(data.lesson)}
          empty="Ближайших занятий нет"
          className="lesson-card"
          action={{ to: (blocks?.lesson?.status === "success" ? blocks.lesson.data?.href : undefined) ?? "/student/schedule", label: "Перейти в расписание" }}
        >
          {(lesson) => (
            <>
              {lesson.current && <p>Сейчас идёт</p>}
              <p className="lesson-title">
                <time dateTime={lesson.startsAt}>{time(lesson.startsAt)}</time>
                <span className="lesson-title-separator" aria-hidden="true"> · </span>
                {lesson.title}
              </p>
              <p>{lesson.href ? `${date(lesson.startsAt)} · ` : ""}{lesson.room}</p>
            </>
          )}
        </SummaryCard>
        <SummaryCard
          title="Важное событие"
          block={blocks?.event ?? success(data.event)}
          empty="Важных событий пока нет"
          className="event-card important-event"
        >
          {(event) => (
            <div className="summary-row">
              <CalendarDays aria-hidden="true" />
              <div>
                {event.courseId && event.semesterId ? <Link to={`/student/academic-performance?${new URLSearchParams({ semester: event.semesterId, discipline: event.courseId })}`}><h3>{event.title}</h3></Link> : <h3>{event.title}</h3>}
                {event.kind && <p>{event.kind}</p>}
                <p>До {date(event.deadline)}</p>
              </div>
            </div>
          )}
        </SummaryCard>
        {livePerformance ? <AcademicSummary /> : (
        <SummaryCard
          title="Успеваемость"
          action={{
            to: "/student/academic-performance",
            label: "Вся успеваемость",
          }}
          className="grades-card"
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
            </>
          )}
        </SummaryCard>
        )}
        {liveRequests ? <RequestSummary /> : <SummaryCard
          title="Моя заявка"
          action={{ to: "/student/requests", label: "Все заявки" }}
          className="request-card"
          block={blocks?.request ?? success(data.request)}
          empty="Заявок пока нет"
        >
          {(request) => (
            <>
              <div className="request-title">
                <FileText className="summary-icon" aria-hidden="true" />
                <h3><Link to={requestDetailsUrl(request.id)}>{request.title}</Link></h3>
              </div>
              <p>
                <span className={"status-badge status-" + requestStatuses[request.status].tone}>
                  {requestStatuses[request.status].label}
                </span>
              </p>
              <p className="muted">Подана {date(request.submittedAt)}</p>
            </>
          )}
        </SummaryCard>}
        {liveNotifications ? <NotificationSummary /> : <SummaryCard
          title="Последние уведомления"
          action={{ to: "/student/notifications", label: "Все уведомления" }}
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
            </>
          )}
        </SummaryCard>}
      </div>
    </>
  );
}

const requestLabels = { in_review: "На рассмотрении" };
export function StudentHome() {

  const { session } = useSession();
  const next = useNextLesson(session?.userId);
  const semesters = useRemote("home-semesters", loadSemesters);
  const semesterId = semesters.data?.defaultSemesterId ?? "";
  const performanceLoad = useCallback((signal: AbortSignal) => loadPerformance(semesterId, signal), [semesterId]);
  const performance = useRemote(semesterId, performanceLoad);
  const nextExam = performance.data?.summary?.nextExam;
  const course = nextExam && performance.data?.disciplines.find((item) => item.id === nextExam.courseId);
  const eventBlock = semesters.error || performance.error
    ? { status: "error" as const, retry: () => { semesters.retry(); performance.retry(); } }
    : !semesters.data || (semesterId && !performance.data)
      ? { status: "loading" as const }
      : { status: "success" as const, data: nextExam ? {
          title: nextExam.name,
          deadline: nextExam.date,
          courseId: nextExam.courseId,
          kind: course?.assessment === "exam" ? "Экзамен" : course?.assessment === "credit" ? "Зачёт" : "Аттестация",
          semesterId,
        } : null };
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
  if (profile === null || next.expired)
    return <Navigate to="/login" state={{ expired: true }} replace />;
  return (
    <>
      <PageHeader title={`Здравствуйте, ${session?.displayName ?? ""}`} headingProps={{ tabIndex: -1 }} />
      {error ? (
        <InlineError message={error} onRetry={() => setAttempt(value => value + 1)} />
      ) : profile ? (
        <p className="muted">
          {profile.university} · {profile.faculty ?? "Факультет не указан"} · {profile.program ?? "Направление не указано"} · Группа {profile.group}
        </p>
      ) : (
        <p role="status">Загружаем профиль…</p>
      )}
      <HomeSummaries data={homeDemo} blocks={{ lesson: next.block, event: eventBlock }} livePerformance liveRequests liveNotifications />
    </>
  );
}
