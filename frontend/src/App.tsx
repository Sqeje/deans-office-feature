import { PublicHome, ApplicantsPage, ContactsPage } from "./modules/identity/PublicHome";
import { PublicSchedulePage } from "./modules/schedule/PublicPage";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Login } from "./modules/identity/Login";
import { modulePages } from "./modules/sections";
import { SessionProvider } from "./shared/session";
import { Cabinet, PageAccess } from "./shared/Cabinet";
import { EmptyState } from "./shared/states";
function LegacyRedirect() {
  const l = useLocation();
  return (
    <Navigate
      replace
      to={l.pathname.replace(/^\/app(?=\/|$)/, "/student") + l.search + l.hash}
    />
  );
}
export function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/applicants" element={<ApplicantsPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/schedule/*" element={<PublicSchedulePage />} />
        <Route path="/app/*" element={<LegacyRedirect />} />
        {(["student", "staff"] as const).map((area) => (
          <Route key={area} path={"/" + area} element={<Cabinet area={area} />}>
            {modulePages
              .filter((p) => p.area === area)
              .map((p) => (
                <Route
                  key={p.path}
                  index={p.path === "" ? true : undefined}
                  path={p.path || undefined}
                  element={
                    <PageAccess page={p}>
                      <p.Page />
                    </PageAccess>
                  }
                />
              ))}
            <Route
              path="*"
              element={
                <EmptyState
                  title="Страница не найдена"
                  text="Выберите раздел в меню."
                />
              }
            />
          </Route>
        ))}
        <Route
          path="*"
          element={
            <main className="p-8">
              <h1>Страница не найдена</h1>
              <Link to="/">На главную</Link>
            </main>
          }
        />
      </Routes>
    </SessionProvider>
  );
}
