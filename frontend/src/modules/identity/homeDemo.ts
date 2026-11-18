import { notificationExamples } from "../notifications/demo";
import { requestExamples } from "../requests/demo";
import type { RequestRecord } from "../requests/model";
export interface HomeDemoSnapshot {
  asOf: string;
  timeZone: string;
  lesson: { id: string; title: string; startsAt: string; room: string; href?: string } | null;
  event: { title: string; deadline: string } | null;
  performance: { average: number; maximum: number; passed: number } | null;
  request: Pick<RequestRecord, 'id' | 'title' | 'status' | 'submittedAt'> | null;
  notifications: { id: string; title: string; unread: boolean }[];
}
export const homeDemo: HomeDemoSnapshot = {
  asOf: "2026-11-09T09:00:00+03:00",
  timeZone: "Europe/Moscow",
  lesson: {
    id: "demo-lesson-1",
    title: "Программирование",
    startsAt: "2026-11-09T12:10:00+03:00",
    room: "Ауд. 305 · Лекция",
  },
  event: { title: "Сдача курсовой работы", deadline: "2026-11-20" },
  performance: { average: 4.6, maximum: 5, passed: 12 },
  request: requestExamples[0],
  notifications: [...notificationExamples],
};
