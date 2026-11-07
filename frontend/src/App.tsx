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
function Applicants() {
  return (
    <main className="mx-auto max-w-3xl p-6 pt-12">
      <Link to="/">← На главную</Link>
      <h1>Будущим студентам</h1>
      <EmptyState
        title="Знакомство с университетом"
        text="Презентационная область. Программы обучения и демонстрационные сценарии появятся в следующих срезах. Подача заявлений здесь не выполняется."
      />
      <Link className="mt-6 inline-block underline" to="/login">
        Вход для студентов и сотрудников
      </Link>
    </main>
  );
}
export function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route
          path="/"
          element={
            <main className="mx-auto max-w-3xl p-6 pt-20">
              <p className="font-semibold text-blue-700">
                ДЕМОНСТРАЦИОННЫЙ ПРОЕКТ
              </p>
              <h1>Цифровой деканат будущего</h1>
              <p className="mb-8 text-lg text-slate-600">
                Расписание, результаты учёбы и связь с университетом в одном
                кабинете.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  className="rounded-lg bg-slate-900 p-3 text-white"
                  to="/login"
                >
                  Войти в кабинет
                </Link>
                <Link className="rounded-lg border p-3" to="/applicants">
                  Абитуриентам
                </Link>
              </div>
              <p className="mt-8 text-sm text-slate-500">
                Все университеты и студенты в прототипе вымышлены.
              </p>
            </main>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/applicants" element={<Applicants />} />
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
