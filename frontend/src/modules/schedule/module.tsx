import type { FrontendModule } from "../../shared/module";
import { Page } from "./Page";
import { ScheduleNavigation } from "./Navigation";
export const scheduleModule: FrontendModule = {
  id: "schedule",
  pages: [
    { area: "student", path: "schedule/*", navigationPath: "schedule", Navigation: ScheduleNavigation, title: "Расписание", Page },
    {
      area: "staff",
      path: "schedule/*",
      navigationPath: "schedule",
      Navigation: ScheduleNavigation,
      title: "Расписание",
      Page,
    },
  ],
};
