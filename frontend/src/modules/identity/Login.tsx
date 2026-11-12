import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { api } from "../../shared/api";
import { useSession } from "../../shared/session";
export function Login() {
  const [params] = useSearchParams();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useSession();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      await api.login(String(data.get("email")), String(data.get("password")));
      const session = await refresh();
      navigate(session?.areas.includes("student") ? "/student" : "/staff");
    } catch {
      setError(
        "Вход не выполнен. Проверьте данные и доступность сервера. После нескольких попыток подождите.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-md p-5 pt-16">
      <Link to="/">← На главную</Link>
      <form onSubmit={submit} className="card mt-6">
        <h1>Вход в кабинет</h1>
        {params.get("expired") === "1" && (
          <p role="status">Сеанс завершён. Войдите снова.</p>
        )}
        <label htmlFor="email">Электронная почта</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={256}
        />
        <label htmlFor="password">Пароль</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
        {error && (
          <p role="alert" className="mb-4 text-red-700">
            {error}
          </p>
        )}
        <Button disabled={busy} className="w-full">
          {busy ? "Входим…" : "Войти"}
        </Button>
      </form>
    </main>
  );
}
