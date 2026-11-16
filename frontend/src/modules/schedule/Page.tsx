import { Navigate, Route, Routes, Link, useParams, useSearchParams } from "react-router-dom";
import { Breadcrumbs, CatalogPage, groupCrumbs, NotFound } from "./CatalogPage";
import { catalogPath, groups, myGroupId, teachers } from "./catalog";
import { ScheduleView } from "./ScheduleView";
import { ScheduleTabs } from "./Navigation";
import "./schedule.css";
export { ScheduleRow } from "./Rows";
function GroupPage({ mine = false }: { mine?: boolean }) {
  const { groupId } = useParams();
  const [search] = useSearchParams();
  const id = mine ? myGroupId : groupId;
  const group = groups.find(g => g.id === id);
  if (!group) return <NotFound />;
  if (!mine && group.id === myGroupId) return <Navigate replace to={`/student/schedule?${search.toString()}`} />;
  return <>
    <Breadcrumbs items={groupCrumbs(group.id)} />
    <ScheduleView entity={{ kind: "group", id: group.id }}
      heading={mine ? "Моё расписание" : `Расписание группы ${group.name}`}
      description={`Демонстрационная группа ${group.name}`} />
  </>;
}
function TeacherPage() {
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
  return <section className="schedule-page">
    <ScheduleTabs />
    <aside className="demo-notice">Демонстрационные данные — не связаны с вашим профилем.</aside>
    <Routes>
      <Route index element={<GroupPage mine />} />
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
