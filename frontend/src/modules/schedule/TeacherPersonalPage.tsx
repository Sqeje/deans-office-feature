import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ApiError } from "../../shared/api";
import { useSession } from "../../shared/session";
import { PageHeader } from "../../components/ui/primitives";
import { ErrorPanel } from "../../shared/states";
import { ScheduleView } from "./ScheduleView";
import { scheduleApi, teacherSource, type TeacherContext } from "./api";

export function TeacherPersonalPage() {
  const { session } = useSession();
  const [context, setContext] = useState<TeacherContext>();
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setContext(undefined); setError(undefined);
    scheduleApi.teacherContext(controller.signal).then(value => { if (!controller.signal.aborted) setContext(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause); });
    return () => controller.abort();
  }, [session?.userId, attempt]);
  if (error instanceof ApiError && error.status === 401) return <Navigate to="/login" state={{ expired: true }} replace />;
  if (!context) return <><PageHeader title="Моё расписание" />{error ? <ErrorPanel
    title={error instanceof ApiError && error.status === 403 ? "Нет доступа к расписанию" : "Не удалось загрузить расписание"}
    message={error instanceof ApiError && error.status === 403 ? "Обратитесь к сотруднику деканата." : "Проверьте соединение и повторите попытку."}
    traceId={error instanceof ApiError ? error.traceId : undefined}
    onRetry={() => setAttempt(v => v + 1)}
  /> : <p role="status">Загружаем расписание…</p>}</>;
  return <>
    <aside className="demo-notice">{context.isDemo ? "Демонстрационные пары тестового преподавателя. Данные сохранены на сервере." : "Ваши занятия. Данные с сервера."}</aside>
    <ScheduleView entity={{ kind: "teacher", id: context.teacherId, name: context.teacherName, personal: true, isDemo: context.isDemo }}
      heading="Моё расписание" description={`Преподаватель: ${context.teacherName}`} source={teacherSource} />
  </>;
}
