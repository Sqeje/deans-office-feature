export interface HomeDemoSnapshot {
  asOf: string;
  timeZone: string;
  lesson: { id: string; title: string; startsAt: string; room: string } | null;
  event: { title: string; deadline: string } | null;
  performance: { average: number; maximum: number; passed: number } | null;
  request: {
    id: string;
    title: string;
    status: "in_review";
    submittedAt: string;
  } | null;
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
  request: {
    id: "demo-request-1",
    title: "Перевод на индивидуальный график",
    status: "in_review",
    submittedAt: "2026-11-06",
  },
  notifications: [
    {
      id: "demo-notification-1",
      title: "Обновлено расписание занятий",
      unread: true,
    },
  ],
};
