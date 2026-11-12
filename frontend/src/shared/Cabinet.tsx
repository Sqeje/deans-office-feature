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
  const { session, error, logout } = useSession();
  const [failed, setFailed] = useState(false),
    [open, setOpen] = useState(false);
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
  if (error || failed) return <ErrorState />;
  if (session === undefined) return <Loading />;
  if (session === null) return <Navigate to="/login" replace />;
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
        onLogout={() => void logout().catch(() => setFailed(true))}
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
          <Brand to={"/" + area} />
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
                onClick={() => void logout().catch(() => setFailed(true))}
              >
                Выйти
              </Button>
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
              const Icon = icons[p.path] ?? FileText;
              return (
                <NavLink
                  end={p.path === ""}
                  key={p.path}
                  to={"/" + area + (p.path ? "/" + p.path : "")}
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                >
                  <Icon aria-hidden="true" />
                  <span>{p.title}</span>
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
