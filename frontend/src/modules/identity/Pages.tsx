import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError, type Profile } from "../../shared/api";

import { Denied, ErrorState, Loading } from "../../shared/states";
import { PageHeader, SectionCard } from "../../components/ui/primitives";
export { StudentHome } from "./StudentHome";
export { StaffHome } from "./StaffHome";
export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>();
  const [error, setError] = useState(false);
  const [denied, setDenied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setProfile(undefined);
    setError(false);
    setDenied(false);
    api
      .me()
      .then(setProfile)
      .catch((e) =>
        e instanceof ApiError && e.status === 403
          ? setDenied(true)
          : setError(true),
      );
  }, [attempt]);
  if (denied) return <Denied />;
  if (error) return <ErrorState title="Не удалось загрузить профиль" text="Проверьте соединение и повторите попытку." onRetry={() => setAttempt(value => value + 1)} />;
  if (profile === null)
    return <Navigate to="/login" state={{ expired: true }} replace />;
  if (!profile) return <Loading />;
  const personal = [
    ["ФИО", profile.fullName],
    ["Почта", profile.email],
  ];
  const study = [
    ["Университет", profile.university],
    ["Группа", profile.group],
    ["Факультет", profile.faculty ?? "Не указан"],
    ["Направление", profile.program ?? "Не указано"],
    ["Курс обучения", profile.courseNumber ? `${profile.courseNumber} курс` : "Не указан"],
    ["Семестр", profile.semesterNumber ? `${profile.semesterNumber} семестр` : "Не указан"],
    ["Продолжительность обучения", profile.studyDurationYears ? `${profile.studyDurationYears} года` : "Не указана"],
  ];
  return (
    <>
      <PageHeader title="Мой профиль" />
      <div className="profile-sections">
        {[{ title: "Личные данные", values: personal }, { title: "Обучение", values: study }].map(section => (
          <SectionCard title={section.title} key={section.title}>
            <dl className="profile-facts">
              {section.values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          </SectionCard>
        ))}
      </div>
    </>
  );
}
