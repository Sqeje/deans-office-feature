import type { FrontendModule } from "../../shared/module";
import { Page } from "./Page";
import { EmptyState } from "../../shared/states";
function StaffPage() {
  return (
    <>
      <h1>Успеваемость</h1>
      <EmptyState
        title="Раздел в разработке"
        text="Рабочие операции сотрудника будут добавлены отдельным срезом."
      />
    </>
  );
}
export const academicPerformanceModule: FrontendModule = {
  id: "academic-performance",
  pages: [
    {
      area: "student",
      path: "academic-performance",
      title: "Успеваемость",
      Page,
    },
    {
      area: "staff",
      path: "academic-performance",
      title: "Успеваемость",
      Page: StaffPage,
      permission: "grades.write",
    },
  ],
};
