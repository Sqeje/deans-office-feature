import type { ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useSession } from "./session";
import { Denied, ErrorState, Loading } from "./states";
import { modulePages } from "../modules/sections";
import type { Area, ModulePage } from "./module";
import { Button } from "../components/ui/button";
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
export function Cabinet({ area }: { area: Area }) {
  const { session, error, logout } = useSession();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const heading = main.current?.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      window.scrollTo(0, 0);
      heading.focus({ preventScroll: true });
    }
  }, [pathname, session]);
  const [failed, setFailed] = useState(false);
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
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <a href="#cabinet-content" className="skip-link">
        Перейти к содержимому
      </a>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <Link to={"/" + area} className="text-lg font-bold">
          Цифровой деканат
        </Link>
        <Button
          variant="outline"
          onClick={() => {
            void logout().catch(() => setFailed(true));
          }}
        >
          Выйти
        </Button>
      </header>
      <div className="mt-6 grid gap-6 md:grid-cols-[210px_1fr]">
        <nav aria-label="Разделы" className="flex flex-wrap gap-2 md:flex-col">
          {pages.map((p) => (
            <NavLink
              end
              key={p.path}
              to={"/" + area + "/" + p.path}
              className={({ isActive }) =>
                `rounded-lg px-3 py-3 text-sm ${isActive ? "bg-slate-900 text-white" : "hover:bg-slate-200"}`
              }
            >
              {p.title}
            </NavLink>
          ))}
          {session.areas
            .filter((a) => a !== area)
            .map((a) => (
              <Link key={a} to={"/" + a}>
                {a === "staff" ? "Кабинет сотрудника" : "Кабинет студента"}
              </Link>
            ))}
        </nav>
        <main className="min-w-0" id="cabinet-content" ref={main} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <footer className="prototype-notice">
        Конкурсный концепт, не официальный сайт
      </footer>
    </div>
  );
}
