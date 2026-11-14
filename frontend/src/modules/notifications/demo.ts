export interface DemoNotification {
  id: string; category: 'grade' | 'schedule' | 'request'; title: string;
  description: string; createdAt: string; unread: boolean; relatedLabel: string;
}
export const notificationExamples: readonly DemoNotification[] = [
  { id: 'demo-grade', category: 'grade', title: 'Добавлена оценка по программированию', description: 'За практическую работу выставлена оценка «Отлично».', createdAt: '2026-11-13T09:00:00Z', unread: true, relatedLabel: 'Практическая работа · Программирование' },
  { id: 'demo-schedule', category: 'schedule', title: 'Изменена аудитория занятия', description: 'Занятие по иностранному языку 16 ноября в 12:10 перенесено из аудитории 305 в аудиторию 412. Время начала осталось прежним.', createdAt: '2026-11-13T08:00:00Z', unread: true, relatedLabel: 'Расписание · Иностранный язык · 16 ноября' },
  { id: 'demo-request', category: 'request', title: 'Справка об обучении готова', description: 'Демонстрационная заявка обработана. Справку можно получить в деканате в часы приёма.', createdAt: '2026-11-12T10:00:00Z', unread: false, relatedLabel: 'Заявка · Справка об обучении' },
];
