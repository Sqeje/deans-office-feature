import type { FrontendModule } from "../../shared/module";
import { Page } from "./Page";
import { ScheduleNavigation } from "./Navigation";
import { EmptyState } from "../../shared/states";
function StaffPage() {
  return (
    <>
      <h1>Расписание</h1>
      <EmptyState
        title="Раздел в разработке"
        text="Рабочие операции сотрудника будут добавлены отдельным срезом."
      />
    </>
  );
}
export const scheduleModule: FrontendModule = {
  id: "schedule",
  pages: [
    { area: "student", path: "schedule/*", navigationPath: "schedule", Navigation: ScheduleNavigation, title: "Расписание", Page },
    {
      area: "staff",
      path: "schedule",
      title: "Расписание",
      Page: StaffPage,
      permission: "schedule.write",
    },
  ],
};
