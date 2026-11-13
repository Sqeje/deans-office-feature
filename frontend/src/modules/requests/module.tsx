import type { FrontendModule } from "../../shared/module";
import { Page } from "./Page";
import { StaffPage } from './StaffPage';
export const requestsModule: FrontendModule = {
  id: "requests",
  pages: [
    { area: "student", path: "requests", title: "Заявки", Page },
    {
      area: "staff",
      path: "requests",
      title: "Заявки",
      Page: StaffPage,
      permission: "requests.manage",
    },
  ],
};
