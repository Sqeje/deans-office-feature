import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { SectionCard, SelectField } from '../../components/ui/primitives';
import { useNotificationDemo, type DemoState } from './state';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});
const categories = { grade: 'Оценки', schedule: 'Расписание', request: 'Заявки' };

export function NotificationContent({ compact = false }: { compact?: boolean }) {
  const { items, state, select, read } = useNotificationDemo();
  if (state === 'loading') return <p role="status">Загружаем уведомления…</p>;
  if (state === 'error') return (
    <div role="alert">
      <p>Не удалось загрузить уведомления. Это демонстрация ошибки.</p>
      <Button variant="outline" onClick={() => select('filled')}>Повторить</Button>
    </div>
  );
  if (!items.length) return <p>Уведомлений пока нет</p>;
  const sorted = [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <ul className={compact ? 'notification-list' : 'notifications-feed'}>
      {(compact ? sorted.slice(0, 3) : sorted).map(item => (
        <li key={item.id} className={item.unread ? 'notification-unread' : ''}>
          <Bell aria-hidden="true" />
          <div className="notification-body">
            <p className="notification-category">{categories[item.category]}</p>
            <h3>{item.title}</h3>
            <p className="muted">
              <time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time> · Москва
            </p>
            <p>{item.unread ? 'Не прочитано' : 'Прочитано'}</p>
            {!compact && (
              <>
                <p>{item.description}</p>
                <p className="muted">{item.relatedLabel}</p>
                {item.unread && (
                  <Button variant="outline" onClick={() => read(item.id)}>Отметить прочитанным</Button>
                )}
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function NotificationSummary() {
  return (
    <section className="card notification-summary">
      <h2>Последние уведомления</h2>
      <p className="muted">Демонстрационные уведомления</p>
      <NotificationContent compact />
      <Link to="/student/notifications">Все уведомления</Link>
    </section>
  );
}

export function Page() {
  const { state, unread, select, read } = useNotificationDemo();
  return (
    <div className="notifications-page">
      <h1>Уведомления</h1>
      <aside className="demo-notice">
        Демонстрационные данные — не связаны с вашим учебным профилем.
        Прочтение действует до перезагрузки страницы.
        Связанные записи вымышлены и недоступны для перехода.
      </aside>
      <SectionCard title="Демонстрационные состояния">
        <SelectField id="notification-demo-state" label="Состояние демонстрации"
          value={state} onChange={event => select(event.target.value as DemoState)}>
          <option value="filled">Наполненная лента</option>
          <option value="empty">Пустая лента</option>
          <option value="loading">Загрузка</option>
          <option value="error">Ошибка</option>
        </SelectField>
      </SectionCard>
      <section className="card">
        <div className="notifications-toolbar">
          <p role="status">{unread === null ? 'Счётчик недоступен' : `Непрочитанных: ${unread}`}</p>
          <Button variant="outline" disabled={!unread} onClick={() => read()}>
            Отметить всё как прочитанное
          </Button>
        </div>
        <NotificationContent />
      </section>
    </div>
  );
}
