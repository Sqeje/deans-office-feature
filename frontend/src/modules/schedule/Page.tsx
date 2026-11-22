import { useSession } from "../../shared/session";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Breadcrumbs, CatalogPage, NotFound } from "./CatalogPage";
import { ErrorPanel } from "../../shared/states";
import { PageHeader } from "../../components/ui/primitives";
import { ApiError } from "../../shared/api";
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
  const { data, error, retry } = useServerCatalog();
  if (error instanceof ApiError && error.status === 401 && !publicSchedule) return <Navigate to="/login?expired=1" replace />;
  if (error) return <><PageHeader title="Расписание группы"/><ErrorPanel title="Не удалось загрузить каталог" message="Проверьте соединение и повторите попытку." traceId={error instanceof ApiError ? error.traceId : undefined} onRetry={retry}/></>;
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
  const { data, error, retry } = useServerCatalog();
  if (error instanceof ApiError && error.status === 401 && !publicSchedule) return <Navigate to="/login?expired=1" replace />;
  if (error) return <><PageHeader title="Расписание преподавателя"/><ErrorPanel title="Не удалось загрузить каталог" message="Проверьте соединение и повторите попытку." traceId={error instanceof ApiError ? error.traceId : undefined} onRetry={retry}/></>;
  if (!data) return <p role="status">Загрузка…</p>;
  const teacher = data.teachers.find(t => t.id === teacherId);
  if (!teacher) return <NotFound />;
  return <>
    <Breadcrumbs items={[{ title: "Все расписания", to: catalogPath }, { title: teacher.name }]} />
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
