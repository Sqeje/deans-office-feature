import { useLocation } from "react-router-dom";

export function useSchedulePaths() {
  const { pathname } = useLocation();
  const staff = pathname === "/staff" || pathname.startsWith("/staff/");
  const base = staff ? "/staff/schedule" : "/student/schedule";
  return { base, catalog: `${base}/catalog`, staff, pathname: pathname.replace(/\/$/, "") };
}
