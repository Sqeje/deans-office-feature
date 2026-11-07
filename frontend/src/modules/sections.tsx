import { registerModules } from "../shared/module";
import { identityModule } from "./identity/module";
import { scheduleModule } from "./schedule/module";
import { academicPerformanceModule } from "./academic-performance/module";
import { requestsModule } from "./requests/module";
import { notificationsModule } from "./notifications/module";
export const modulePages = registerModules([
  identityModule,
  scheduleModule,
  academicPerformanceModule,
  requestsModule,
  notificationsModule,
]);
