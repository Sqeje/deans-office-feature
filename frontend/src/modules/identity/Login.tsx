import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Brand, PrototypeNotice } from "../../shared/brand";
import { api, ApiError, type Session } from "../../shared/api";
import { useSession } from "../../shared/session";
import { setTabLoginPending } from "./tabAccount";
const destination = (s: Session | null | undefined) =>
  s?.areas.includes("student")
    ? "/student"
    : s?.areas.includes("staff")
      ? "/staff"
      : null;
export function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false);
  const [fields, setFields] = useState({ username: "", password: "" });
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const [params] = useSearchParams();
  const expired = useLocation().state?.expired || params.get("expired") === "1";
  const navigate = useNavigate();
  const { session, accountChanged, refresh, logout } = useSession();
  useEffect(() => {
    const to = destination(session);
    if (to && !expired && !accountChanged) navigate(to, { replace: true });
  }, [session, navigate, expired, accountChanged]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    const data = new FormData(e.currentTarget),
      username = String(data.get("username")),
      password = String(data.get("password"));
    const errors = {
      username: !username.trim()
        ? "Введите логин"
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)
          ? "Введите электронную почту"
          : "",
      password: !password ? "Введите пароль" : "",
    };
    setFields(errors);
    setError("");
    if (errors.username || errors.password) {
      form.current
        ?.querySelector<HTMLInputElement>(
          errors.username ? "#username" : "#password",
        )
        ?.focus();
      return;
    }
    lock.current = true;
    setTabLoginPending(true);
    setBusy(true);
    try {
      await api.login(username, password);
      const current = await refresh(true);
      const to = destination(current);
      if (to) navigate(to);
      else
        setError(
          "Для учётной записи нет доступного кабинета. Обратитесь к администратору.",
        );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.status === 401
            ? "Не удалось войти. Проверьте логин и пароль"
            : "Не удалось выполнить вход. Попробуйте ещё раз."
          : "Не удалось связаться с сервером. Попробуйте ещё раз",
      );
    } finally {
      setTabLoginPending(false);
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <Brand />
        <form ref={form} onSubmit={submit} noValidate aria-busy={busy}>
          <h1>Вход в кабинет</h1>
          {accountChanged ? <p role="status">Учётная запись в другой вкладке изменена или выполнен выход. Войдите снова.</p>
            : expired && <p role="status">Сеанс завершён. Войдите снова</p>}
          <div className="field">
            <label htmlFor="username">Логин</label>
            <p id="username-hint" className="muted">
              Электронная почта
            </p>
            <input
              id="username"
              name="username"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={256}
              aria-label="Логин — Электронная почта"
              aria-invalid={!!fields.username}
              aria-describedby="username-hint username-error"
            />
            <p id="username-error" className="field-error">
              {fields.username}
            </p>
          </div>
          <div className="field">
            <label htmlFor="password">Пароль</label>
            <div className="password-control">
              <input
                id="password"
                name="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={256}
                aria-invalid={!!fields.password}
                aria-describedby="password-error"
              />
              <button
                className="icon-button"
                type="button"
                aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </button>
            </div>
            <p id="password-error" className="field-error">
              {fields.password}
            </p>
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <Button disabled={busy} className="auth-submit">
            {busy && <LoaderCircle aria-hidden="true" />}
            {busy ? "Входим…" : "Войти"}
          </Button>
          {session && !destination(session) && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void logout().catch(() =>
                  setError("Не удалось выйти. Попробуйте ещё раз."),
                )
              }
            >
              Выйти из учётной записи
            </Button>
          )}
        </form>
        <Link className="auth-back" to="/">
          ← Вернуться на главную
        </Link>
        <PrototypeNotice />
      </section>
    </main>
  );
}
