import { useEffect, useState } from "react";
import { ApiError } from "../../shared/api";
import { scheduleApi } from "./api";
import { dateKey } from "./model";

export interface NextLessonSummary { id: string; title: string; startsAt: string; endsAt: string; room: string; href: string; current: boolean }
type NextBlock = { status: "loading" } | { status: "error"; retry: () => void } | { status: "success"; data: NextLessonSummary | null };
export function useNextLesson(userId?: string) {
  const [attempt, setAttempt] = useState(0);
  const [block, setBlock] = useState<NextBlock>({ status: "loading" });
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const refresh = () => setAttempt(v => v + 1);
    const visible = () => { if (!document.hidden) refresh(); };
    const timer = window.setInterval(visible, 60_000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setBlock({ status: "loading" }); setExpired(false);
    scheduleApi.next(controller.signal).then(({ event }) => {
      if (controller.signal.aborted) return;
      const now = Date.now();
      setBlock({ status: "success", data: event ? { id: event.id, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt,
        room: `${event.room} · ${event.kind} · Группа ${event.groupName}`,
        current: Date.parse(event.startsAt) <= now && now < Date.parse(event.endsAt),
        href: `/student/schedule?view=today&day=${dateKey(new Date(event.startsAt))}&event=${event.id}#lesson-${event.id}` } : null });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) setExpired(true);
      setBlock({ status: "error", retry: () => setAttempt(v => v + 1) });
    });
    return () => controller.abort();
  }, [userId, attempt]);
  return { block, expired };
}
