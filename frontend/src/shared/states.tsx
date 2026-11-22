import { Button } from "../components/ui/button";
import type { ReactNode } from "react";
export function Loading() {
  return (
    <p className="p-6" role="status">
      Загрузка…
    </p>
  );
}
export function ErrorState({
  title = "Не удалось загрузить страницу",
  text = "Сервер недоступен. Повторите попытку.",
  onRetry = () => location.reload(),
}: {
  title?: string;
  text?: string;
  onRetry?: () => void;
}) {
  return (
    <main className="error-state" role="alert">
      <h1>{title}</h1>
      <p>{text}</p>
      <Button variant="primary" onClick={onRetry}>Повторить</Button>
    </main>
  );
}

export function ErrorPanel({ title, message, onRetry, traceId, action }: { title: string; message: string; onRetry?: () => void; traceId?: string; action?: ReactNode }) {
  return (
    <section className="error-state" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      {traceId && <p className="muted">Код обращения: {traceId}</p>}
      {(onRetry || action) && <div className="error-state-actions">{onRetry && <Button variant="primary" onClick={onRetry}>Повторить</Button>}{action}</div>}
    </section>
  );
}

export function InlineError({ message, onRetry, traceId }: { message: string; onRetry?: () => void; traceId?: string }) {
  return (
    <div className="inline-error" role="alert">
      <p>{message}</p>
      {traceId && <p className="muted">Код обращения: {traceId}</p>}
      {onRetry && <Button variant="outline" size="compact" onClick={onRetry}>Повторить</Button>}
    </div>
  );
}
export function Denied() {
  return (
    <div className="card" role="alert">
      <h1>Нет доступа</h1>
      <p>У вашей учётной записи нет разрешения на этот раздел.</p>
    </div>
  );
}
export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="empty-state-text">{text}</p>
    </section>
  );
}
