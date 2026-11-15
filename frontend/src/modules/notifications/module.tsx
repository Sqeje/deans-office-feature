import type { FrontendModule } from "../../shared/module";
import { Page } from "./Page";
import { StaffPage } from './StaffPage';
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
