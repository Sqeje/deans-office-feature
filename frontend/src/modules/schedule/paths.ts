import { useLocation } from "react-router-dom";

export function useSchedulePaths() {
  const { pathname } = useLocation();
  const staff = pathname === "/staff" || pathname.startsWith("/staff/");
  const publicSchedule = pathname === "/schedule" || pathname.startsWith("/schedule/");
  const base = publicSchedule ? "/schedule" : staff ? "/staff/schedule" : "/student/schedule";
  return { base, catalog: publicSchedule ? base : `${base}/catalog`, staff, publicSchedule, pathname: pathname.replace(/\/$/, "") };
}
