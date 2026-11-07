import { Button } from "../components/ui/button";
export function Loading() {
  return (
    <p className="p-6" role="status">
      Загрузка…
    </p>
  );
}
export function ErrorState({
  text = "Сервер недоступен. Повторите попытку.",
}: {
  text?: string;
}) {
  return (
    <main className="p-6" role="alert">
      <p className="mb-4">{text}</p>
      <Button onClick={() => location.reload()}>Повторить</Button>
    </main>
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
      <p className="mt-3 text-slate-600">{text}</p>
    </section>
  );
}
