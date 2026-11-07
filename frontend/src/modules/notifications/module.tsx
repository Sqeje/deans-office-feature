import type { FrontendModule } from "../../shared/module";
import { Page } from "./Page";
import { EmptyState } from "../../shared/states";
function StaffPage() {
  return (
    <>
      <h1>Уведомления</h1>
      <EmptyState
        title="Раздел в разработке"
        text="Рабочие операции сотрудника будут добавлены отдельным срезом."
      />
    </>
  );
}
export const notificationsModule: FrontendModule = {
  id: "notifications",
  pages: [
    { area: "student", path: "notifications", title: "Уведомления", Page },
    {
      area: "staff",
      path: "notifications",
      title: "Уведомления",
      Page: StaffPage,
      permission: "announcements.publish",
    },
  ],
};
