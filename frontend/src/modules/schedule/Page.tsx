import { Route, Routes, Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Breadcrumbs, CatalogPage, groupCrumbs, NotFound } from "./CatalogPage";
import { groups, teachers } from "./catalog";
import { ScheduleView } from "./ScheduleView";
import { ScheduleTabs } from "./Navigation";
import { PersonalPage } from "./PersonalPage";
import { TeacherPersonalPage } from "./TeacherPersonalPage";
import { StaffPage } from "./StaffPage";
import { useSchedulePaths } from "./paths";
import "./schedule.css";
export { ScheduleRow } from "./Rows";
function GroupPage() {
  const { catalog } = useSchedulePaths();
  const { groupId } = useParams();
  const id = groupId;
  const group = groups.find(g => g.id === id);
  if (!group) return <NotFound />;
  return <>
    <Breadcrumbs items={groupCrumbs(group.id, catalog)} />
    <ScheduleView entity={{ kind: "group", id: group.id }}
      heading={`Расписание группы ${group.name}`}
      description={`Демонстрационная группа ${group.name}`} />
  </>;
}
function TeacherPage() {
  const { catalog: catalogPath } = useSchedulePaths();
  const { teacherId } = useParams();
  const [search] = useSearchParams();
  const teacher = teachers.find(t => t.id === teacherId);
  if (!teacher) return <NotFound />;
  const back = `${catalogPath}?${new URLSearchParams({ q: search.get("q") ?? teacher.name }).toString()}`;
  return <>
    <Breadcrumbs items={[{ title: "Все расписания", to: catalogPath }, { title: "Преподаватели", to: back }, { title: teacher.name }]} />
    <Link className="schedule-back" to={back}>← К поиску преподавателя</Link>
    <ScheduleView entity={{ kind: "teacher", id: teacher.id }}
      heading={teacher.name} description="Расписание преподавателя" />
  </>;
}
export function Page() {
  const { pathname } = useLocation();
  const { base, staff } = useSchedulePaths();
  const personal = pathname.replace(/\/$/, "") === base;
  const editing = staff && pathname === `${base}/edit`;
  return <section className="schedule-page">
    <ScheduleTabs />
    {!personal && !editing && <aside className="demo-notice">Каталог и расписания преподавателей: демонстрационные данные — не связаны с вашим профилем.</aside>}
    <Routes>
      <Route index element={staff ? <TeacherPersonalPage /> : <PersonalPage />} />
      {staff && <Route path="edit" element={<StaffPage />} />}
      <Route path="catalog" element={<CatalogPage />} />
      <Route path="catalog/:directionId" element={<CatalogPage />} />
      <Route path="catalog/:directionId/:programId" element={<CatalogPage />} />
      <Route path="catalog/:directionId/:programId/:year" element={<CatalogPage />} />
      <Route path="groups/:groupId" element={<GroupPage />} />
      <Route path="teachers/:teacherId" element={<TeacherPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </section>;
}
