import { useSession } from "../../shared/session";
import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useSchedulePaths } from "./paths";
function useItems() {
  const paths = useSchedulePaths();
  const { session } = useSession();
  const teacher = !!session?.roles.includes("Teacher") && !session.roles.includes("Dean") && !!session.permissions.some(p => p.permission === "schedule.write");
  const inSchedule = paths.pathname === paths.base || paths.pathname.startsWith(`${paths.base}/`);
  const editing = paths.staff && paths.pathname === `${paths.base}/edit`;
  return { ...paths, items: [
    ...(!paths.staff || teacher ? [{ to: paths.base, label: "Моё расписание", active: paths.pathname === paths.base }] : []),
    { to: paths.catalog, label: "Все расписания", active: inSchedule && (paths.staff && !teacher || paths.pathname !== paths.base) && !editing },
    ...(paths.staff && teacher ? [{ to: `${paths.base}/edit`, label: "Редактировать расписание", active: editing }] : []),
  ] };
}
export function ScheduleNavigation() {
  const { pathname, base, catalog, staff, items } = useItems();
  const { session } = useSession();
  const teacher = !!session?.roles.includes("Teacher") && !session.roles.includes("Dean") && !!session.permissions.some(p => p.permission === "schedule.write");
  const [open, setOpen] = useState(false);
  if (staff && !teacher) return <NavLink to={catalog} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} aria-current={pathname.startsWith(base) ? "page" : undefined}>
    <CalendarDays aria-hidden="true" /><span>Расписания</span>
  </NavLink>;
  return <div className="schedule-nav-entry">
    <div className="schedule-nav-parent">
      <NavLink to={base} aria-current={pathname === base ? "page" : false} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
        <CalendarDays aria-hidden="true" /><span>Расписание</span>
      </NavLink>
      <button type="button" aria-label="Подразделы расписания" aria-expanded={open} aria-controls="schedule-submenu" onClick={() => setOpen(value => !value)}><ChevronDown aria-hidden="true" /></button>
    </div>
    {open && <div id="schedule-submenu" className="schedule-submenu">
      {items.map(item => <Link key={item.to} to={item.to} className={item.active ? "active" : undefined} aria-current={item.active ? "page" : undefined}>{item.label}</Link>)}
    </div>}
  </div>;
}
export function ScheduleTabs() {
  const { staff, items } = useItems();
  return <div className={`schedule-section-tabs${staff ? " schedule-teacher-tabs" : ""}`} role="group" aria-label="Подразделы расписания">
    {items.map(item => <Link key={item.to} to={item.to} aria-current={item.active ? "page" : undefined}>{item.label}</Link>)}
  </div>;
}
