import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { PublicLayout } from "../identity/PublicHome";
import { CatalogPage, NotFound } from "./CatalogPage";
import { GroupPage, TeacherPage } from "./Page";
import "./schedule.css";

export function PublicSchedulePage() {
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const focusHeading = () => {
      const heading = main.current?.querySelector("h1");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus();
      return !!heading;
    };
    window.scrollTo(0, 0);
    if (focusHeading()) return;
    const observer = new MutationObserver(() => { if (focusHeading()) observer.disconnect(); });
    if (main.current) observer.observe(main.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  return <PublicLayout infoActions={<Link className="public-info-action" to="/">
    <ArrowLeft aria-hidden="true" />На главную
  </Link>}>
    <main id="public-main" ref={main} tabIndex={-1} className="schedule-page public-schedule-main">
      <aside className="demo-notice">Общий каталог расписаний университета. Данные с сервера; изменения преподавателей видны всем.</aside>
      <Routes>
        <Route index element={<CatalogPage />} />
        <Route path="groups/:groupId" element={<GroupPage />} />
        <Route path="teachers/:teacherId" element={<TeacherPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
  </PublicLayout>;
}
