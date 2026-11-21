import { Link } from "react-router-dom";
import { useSession } from "../../shared/session";
import { useRemote, RequestFailure } from "../academic-performance/remote";
import { loadStaffContext } from "./staffContext";
import "../academic-performance/performance.css";
import { TeacherNext } from "./TeacherNext";
import { Button } from "../../components/ui/button";
import { formatSemesterLabel } from "../academic-performance/model";

export function StaffHome() {
  const { session } = useSession();
  const context = useRemote(session?.userId ?? "", loadStaffContext);
  return <div className="performance-staff">
    <p className="muted">Рабочее место сотрудника</p><h1>Здравствуйте, {session?.displayName}</h1>
    {context.error ? <RequestFailure error={context.error} retry={context.retry} title="Не удалось загрузить рабочее место" /> : !context.data ? <p role="status">Загружаем назначения…</p> : <>
      <p>Ваши роли: {context.data.roles.filter(role => role !== "Staff").map(role => ({ Teacher: "Преподаватель", Dean: "Сотрудник деканата", Student: "Студент" })[role] ?? role).concat(context.data.roles.includes("Staff") && !context.data.roles.some(role => role === "Teacher" || role === "Dean") ? ["Сотрудник университета"] : []).join(", ") || "Роли пока не назначены"}</p>
      {context.data.roles.includes("Teacher") && <TeacherNext />}
      <section className="academic-panel"><h2>Задачи</h2><div className="staff-links">
        {context.data.roles.includes("Teacher") && context.data.assignments.length > 0 && session?.permissions.some(p => p.permission === "journal.write") && <Button asChild><Link to="/staff/academic-performance?view=journal">Заполнить журнал занятий</Link></Button>}
        {session?.permissions.some(p => p.permission === "requests.manage") && <Button asChild><Link to="/staff/requests">Обработать обращения</Link></Button>}
      </div></section>
      <section className="academic-panel"><h2>Мои группы и дисциплины</h2>
        {!context.data.groups.length && <p className="muted">Группы пока не назначены. Обратитесь к администратору университета.</p>}
        {context.data.groups.map(group => <div className="staff-assignment" key={group.id}><h3>{group.name}</h3>
          {context.data?.roles.includes("Teacher") && session?.permissions.some(p => p.permission === "journal.write") && context.data?.assignments.filter(a => a.groupId === group.id).map(a => <p key={a.id}><Link to={"/staff/academic-performance?" + new URLSearchParams({ view: "journal", course: a.courseId })}>{a.courseName} · {formatSemesterLabel(a.semesterId)}</Link></p>)}
        </div>)}
      </section>
    </>}
  </div>;
}
