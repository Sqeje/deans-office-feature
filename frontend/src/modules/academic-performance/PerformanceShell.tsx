import type { ReactNode, Ref } from "react";
import { Link, NavLink } from "react-router-dom";
import type { ModulePage } from "../../shared/module";
import { Icon } from "./Icon";
import "./performance.css";
export function PerformanceShell({
  mainRef,
  children,
  pages,
  name,
  onLogout,
  loggingOut = false,
  logoutError,
}: {
  mainRef?: Ref<HTMLElement>;
  children: ReactNode;
  pages: ModulePage[];
  name: string;
  onLogout: () => void;
  loggingOut?: boolean;
  logoutError?: ReactNode;
}) {
  const icons: Record<string, string> = {
    "": "home",
    schedule: "calendar",
    "academic-performance": "chart",
    requests: "document",
    notifications: "bell",
  };
  return (
    <div className="academic-shell">
      <a className="skip-link" href="#academic-main">
        Перейти к содержимому
      </a>
      <aside className="academic-sidebar">
        <Link to="/student" className="academic-brand">
          Деканат<span>Студенческий портал</span>
        </Link>
        <nav aria-label="Разделы">
          {pages
            .filter((p) => p.path !== "profile")
            .map((p) => (
              <NavLink
                end={p.path !== "academic-performance"}
                key={p.path}
                to={"/student/" + p.path}
              >
                <Icon name={icons[p.path] ?? "document"} />
                <span>{p.path === "requests" ? "Заявки" : p.title}</span>
              </NavLink>
            ))}
        </nav>
      </aside>
      <div className="academic-content">
        <div className="academic-account">
          <details
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                const el = event.currentTarget;
                el.open = false;
                el.querySelector("summary")?.focus();
              }
            }}
          >
            <summary aria-label="Меню профиля">
              <span>{name.trim().charAt(0) || "С"}</span>
              <Icon name="down" />
            </summary>
            <div className="academic-account-menu">
              <Link to="/student/profile">Мой профиль</Link>
              <button disabled={loggingOut} onClick={onLogout}>{loggingOut ? "Выходим…" : "Выйти"}</button>
              {logoutError}
            </div>
          </details>
        </div>
        <main ref={mainRef} id="academic-main" tabIndex={-1}>
          {children}
        </main>
        <footer>
          Конкурсный концепт, не официальный сайт · Демонстрационные данные
        </footer>
      </div>
    </div>
  );
}
