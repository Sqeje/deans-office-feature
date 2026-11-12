import type { FrontendModule } from "../../shared/module";
import { Page } from "./Page";
import { StaffPage } from "./StaffPage";
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
