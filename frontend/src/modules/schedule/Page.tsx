import { useSession } from "../../shared/session";
import { Navigate, Route, Routes, Link, useParams, useSearchParams } from "react-router-dom";
import { Breadcrumbs, CatalogPage, NotFound } from "./CatalogPage";
import { useServerCatalog, catalogSource, publicCatalogSource } from "./serverCatalog";
import { ScheduleView } from "./ScheduleView";
import { ScheduleTabs } from "./Navigation";
import { PersonalPage } from "./PersonalPage";
import { TeacherPersonalPage } from "./TeacherPersonalPage";
import { StaffPage } from "./StaffPage";
import { useSchedulePaths } from "./paths";
import "./schedule.css";
export { ScheduleRow } from "./Rows";
export function GroupPage() {
  const { catalog, publicSchedule } = useSchedulePaths();
  const { groupId } = useParams();
  const id = groupId;
  const { data, error } = useServerCatalog();
  if (error) return <p role="alert">Не удалось загрузить каталог.</p>;
  if (!data) return <p role="status">Загрузка…</p>;
  const group = data.groups.find(g => g.id === id);
  if (!group) return <NotFound />;
  return <>
    <Breadcrumbs items={[{ title: "Все расписания", to: catalog }, { title: group.name }]} />
    <ScheduleView source={publicSchedule ? publicCatalogSource : catalogSource} entity={{ kind: "group", id: group.id, name: group.name, serverBacked: true }}
      heading={`Расписание группы ${group.name}`}
      description={`Группа ${group.name}`} />
  </>;
}
export function TeacherPage() {
  const { catalog: catalogPath, publicSchedule } = useSchedulePaths();
  const { teacherId } = useParams();
  const [search] = useSearchParams();
  const { data, error } = useServerCatalog();
  if (error) return <p role="alert">Не удалось загрузить каталог.</p>;
  if (!data) return <p role="status">Загрузка…</p>;
  const teacher = data.teachers.find(t => t.id === teacherId);
  if (!teacher) return <NotFound />;
  const back = `${catalogPath}?${new URLSearchParams({ q: search.get("q") ?? teacher.name }).toString()}`;
  return <>
    <Breadcrumbs items={[{ title: "Все расписания", to: catalogPath }, { title: "Преподаватели", to: back }, { title: teacher.name }]} />
    <Link className="schedule-back" to={back}>← К поиску преподавателя</Link>
    <ScheduleView source={publicSchedule ? publicCatalogSource : catalogSource} entity={{ kind: "teacher", id: teacher.id, name: teacher.name, serverBacked: true }}
      heading={teacher.name} description="Расписание преподавателя" />
  </>;
}
export function Page() {

  const { staff } = useSchedulePaths();
  const { session } = useSession();
  const teacher = !!session?.roles.includes("Teacher") && !session.roles.includes("Dean") && !!session.permissions.some(p => p.permission === "schedule.write");


  return <section className="schedule-page">
    {!(staff && !teacher) && <ScheduleTabs />}

    <Routes>
      <Route index element={staff ? teacher ? <TeacherPersonalPage /> : <Navigate to="catalog" replace /> : <PersonalPage />} />
      {staff && teacher && <Route path="edit" element={<StaffPage />} />}
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
