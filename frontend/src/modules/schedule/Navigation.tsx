import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
export function ScheduleNavigation() {
  const { pathname } = useLocation();
  const active = pathname.startsWith("/student/schedule");
  const [open, setOpen] = useState(false);
  return <div className="schedule-nav-entry">
    <div className="schedule-nav-parent">
      <NavLink to="/student/schedule" aria-current={pathname === "/student/schedule" ? "page" : false} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
        <CalendarDays aria-hidden="true" /><span>Расписание</span>
      </NavLink>
      <button type="button" aria-label="Подразделы расписания" aria-expanded={open} aria-controls="schedule-submenu" onClick={() => setOpen(value => !value)}><ChevronDown aria-hidden="true" /></button>
    </div>
    {open && <div id="schedule-submenu" className="schedule-submenu">
      <Link to="/student/schedule" className={active && pathname === "/student/schedule" ? "active" : undefined} aria-current={active && pathname === "/student/schedule" ? "page" : undefined}>Моё расписание</Link>
      <Link to="/student/schedule/catalog" className={active && pathname !== "/student/schedule" ? "active" : undefined} aria-current={active && pathname !== "/student/schedule" ? "page" : undefined}>Все расписания</Link>
    </div>}
  </div>;
}
export function ScheduleTabs() {
  const { pathname } = useLocation();
  return <div className="schedule-section-tabs" role="group" aria-label="Подразделы расписания">
    <Link to="/student/schedule" aria-current={pathname === "/student/schedule" ? "page" : undefined}>Моё расписание</Link>
    <Link to="/student/schedule/catalog" aria-current={pathname !== "/student/schedule" ? "page" : undefined}>Все расписания</Link>
  </div>;
}
