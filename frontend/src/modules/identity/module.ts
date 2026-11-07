import type { FrontendModule } from "../../shared/module";
import { StudentHome, StaffHome, ProfilePage } from "./Pages";
export const identityModule: FrontendModule = {
  id: "identity",
  pages: [
    { area: "student", path: "", title: "Главная", Page: StudentHome },
    { area: "student", path: "profile", title: "Профиль", Page: ProfilePage },
    { area: "staff", path: "", title: "Главная", Page: StaffHome },
  ],
};
