import type { FrontendModule } from "../../shared/module";
import { Page } from "./Page";
import { EmptyState } from "../../shared/states";
function StaffPage() {
  return (
    <>
      <h1>Обращения</h1>
      <EmptyState
        title="Раздел в разработке"
        text="Рабочие операции сотрудника будут добавлены отдельным срезом."
      />
    </>
  );
}
export const requestsModule: FrontendModule = {
  id: "requests",
  pages: [
    { area: "student", path: "requests", title: "Обращения", Page },
    {
      area: "staff",
      path: "requests",
      title: "Обращения",
      Page: StaffPage,
      permission: "requests.manage",
    },
  ],
};
