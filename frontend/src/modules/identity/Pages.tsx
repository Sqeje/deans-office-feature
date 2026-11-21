import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError, type Profile } from "../../shared/api";

import { Denied, ErrorState, Loading } from "../../shared/states";
export { StudentHome } from "./StudentHome";
export { StaffHome } from "./StaffHome";
export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>();
  const [error, setError] = useState(false);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    api
      .me()
      .then(setProfile)
      .catch((e) =>
        e instanceof ApiError && e.status === 403
          ? setDenied(true)
          : setError(true),
      );
  }, []);
  if (denied) return <Denied />;
  if (error) return <ErrorState />;
  if (profile === null)
    return <Navigate to="/login" state={{ expired: true }} replace />;
  if (!profile) return <Loading />;
  return (
    <>
      <h1>Мой профиль</h1>
      <dl className="card space-y-4">
        {[
          ["ФИО", profile.fullName],
          ["Почта", profile.email],
          ["Университет", profile.university],
          ["Группа", profile.group],
          ["Факультет", profile.faculty ?? "Не указан"],
          ["Направление", profile.program ?? "Не указано"],
          ["Курс обучения", profile.courseNumber ? `${profile.courseNumber} курс` : "Не указан"],
          ["Семестр", profile.semesterNumber ? `${profile.semesterNumber} семестр` : "Не указан"],
          ["Продолжительность обучения", profile.studyDurationYears ? `${profile.studyDurationYears} года` : "Не указана"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-sm text-slate-500">{k}</dt>
            <dd className="break-words font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
