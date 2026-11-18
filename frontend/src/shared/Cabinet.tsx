import { NotificationProvider, NotificationCount } from "../modules/notifications/state";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  Home,
  CalendarDays,
  GraduationCap,
  FileText,
  Bell,
} from "lucide-react";
import { useSession } from "./session";
import { Denied, ErrorState, Loading } from "./states";
import { modulePages } from "../modules/sections";
import type { Area, ModulePage } from "./module";
import { Button } from "../components/ui/button";
import { PerformanceShell } from "../modules/academic-performance/PerformanceShell";
import { Brand, PrototypeNotice } from "./brand";
export function PageAccess({
  page,
  children,
}: {
  page: ModulePage;
  children: ReactNode;
}) {
  const { session } = useSession();
  return page.permission &&
    !session?.permissions.some((p) => p.permission === page.permission) ? (
    <Denied />
  ) : (
    children
  );
}
const icons: Record<string, typeof Home> = {
  "": Home,
  schedule: CalendarDays,
  "academic-performance": GraduationCap,
  requests: FileText,
  notifications: Bell,
};
export function Cabinet({ area }: { area: Area }) {
  const { session } = useSession();
  return area === "student" && session?.areas.includes("student") ? (
    <NotificationProvider key={session.userId}><CabinetContent area={area} /></NotificationProvider>
  ) : <CabinetContent area={area} />;
}
function CabinetContent({ area }: { area: Area }) {
  const { session, error, logout } = useSession();
  const [failed, setFailed] = useState(false),
    [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutLock = useRef(false);
  async function handleLogout() {
    if (logoutLock.current) return;
    logoutLock.current = true;
    setLoggingOut(true);
    setFailed(false);
    try { await logout(); }
    catch { setFailed(true); }
    finally { logoutLock.current = false; setLoggingOut(false); }
  }
  const logoutError = failed ? (
    <p role="alert" className="field-error">Не удалось выйти. Попробуйте ещё раз.</p>
  ) : null;
  const [navigationVersion, setNavigationVersion] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    const heading = main.current?.querySelector("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
  }, [location.pathname, session?.userId]);
  useEffect(() => {
    if (!open) return;
    function close(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    function outside(e: PointerEvent) {
      if (
        !menu.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  if (session === null) return <Navigate to="/login" replace />;
  if (error) return <ErrorState />;
  if (session === undefined) return <Loading />;
  if (!session.areas.includes(area))
    return (
      <main className="p-6">
        <Denied />
        <Link to="/">На главную</Link>
      </main>
    );
  const pages = modulePages.filter(
    (p) =>
      p.area === area &&
      (!p.permission ||
        session.permissions.some((g) => g.permission === p.permission)),
  );
  if (area === "student" && location.pathname === "/student/academic-performance") {
    return (
      <PerformanceShell
        mainRef={main}
        pages={pages}
        name={session.displayName}
        onLogout={() => void handleLogout()}
        loggingOut={loggingOut}
        logoutError={logoutError}
      >
        <Outlet />
      </PerformanceShell>
    );
  }
  const initials = session.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((v) => v[0])
    .join("");
  return (
    <div
      className={
        area === "student" ? "student-shell" : "mx-auto max-w-6xl p-4 sm:p-8"
      }
    >
      <a className="skip-link" href="#cabinet-main">
        К содержимому
      </a>
      <header className="cabinet-header">
        <div className="cabinet-brand">
          <Brand to={"/" + area} onClick={() => setNavigationVersion(value => value + 1)} />
          {area === "student" && <p>Студенческий портал</p>}
        </div>
        <div className="profile-control">
          <button
            ref={trigger}
            className="avatar"
            aria-label="Меню профиля"
            aria-expanded={open}
            aria-controls="profile-menu"
            onClick={() => setOpen(!open)}
          >
            {initials}
          </button>
          {open && (
            <div id="profile-menu" ref={menu} className="profile-menu">
              <p>{session.displayName}</p>
              {area === "student" && <Link to="/student/profile">Профиль</Link>}
              {session.areas
                .filter((a) => a !== area)
                .map((a) => (
                  <Link key={a} to={"/" + a}>
                    {a === "staff" ? "Кабинет сотрудника" : "Кабинет студента"}
                  </Link>
                ))}
              <Button
                variant="outline"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
              >
                {loggingOut ? "Выходим…" : "Выйти"}
              </Button>
              {logoutError}
            </div>
          )}
        </div>
      </header>
      <div
        className={
          area === "student"
            ? "student-layout"
            : "mt-6 grid gap-6 md:grid-cols-[210px_1fr]"
        }
      >
        <nav aria-label="Разделы" className="cabinet-nav">
          {pages
            .filter((p) => area !== "student" || p.path !== "profile")
            .map((p) => {
              if (p.Navigation) {
                const Navigation = p.Navigation;
                // Activating the brand also resets navigation when already on home.
                return <Navigation key={`${p.path}:${navigationVersion}`} />;
              }
              const path = p.navigationPath ?? p.path;
              const Icon = icons[path] ?? FileText;
              return (
                <NavLink
                  end={p.path === ""}
                  key={p.path}
                  to={"/" + area + (path ? "/" + path : "")}
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                >
                  <Icon aria-hidden="true" />
                  <span>{p.title}</span>
                  {area === "student" && p.path === "notifications" && <NotificationCount />}
                </NavLink>
              );
            })}
        </nav>
        <main ref={main} id="cabinet-main" className="cabinet-main">
          <Outlet />
          <footer>
            <PrototypeNotice />
          </footer>
        </main>
      </div>
    </div>
  );
}
