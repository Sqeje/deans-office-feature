import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ApiError } from "../../shared/api";
import { Button } from "../../components/ui/button";

export function useRemote<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    attempt: number;
    data?: T;
    error?: unknown;
  }>({ key: "", attempt: -1 });
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    setState({ key, attempt });
    Promise.resolve()
      .then(() => load(controller.signal))
      .then(
        (data) => {
          if (!controller.signal.aborted) setState({ key, attempt, data });
        },
        (error: unknown) => {
          if (!controller.signal.aborted) setState({ key, attempt, error });
        },
      );
    return () => controller.abort();
  }, [key, load, attempt]);
  const current = key && state.key === key && state.attempt === attempt;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    retry: () => setAttempt((n) => n + 1),
  };
}
export function RequestFailure({
  error,
  retry,
  title = "Не удалось загрузить успеваемость",
}: {
  error: unknown;
  retry: () => void;
  title?: string;
}) {
  if (error instanceof ApiError && error.status === 401)
    return <Navigate to="/login?expired=1" replace />;
  const denied = error instanceof ApiError && error.status === 403;
  return (
    <section className="academic-panel" role="alert">
      <h2>{denied ? "Нет доступа" : title}</h2>
      <p>
        {denied
          ? "Нет разрешения на эти данные. Обратитесь к сотруднику деканата."
          : "Попробуйте ещё раз."}
      </p>
      {error instanceof ApiError && error.traceId && (
        <p className="muted">Код обращения: {error.traceId}</p>
      )}
      {!denied && (
        <Button variant="primary" onClick={retry}>
          Повторить
        </Button>
      )}
    </section>
  );
}
