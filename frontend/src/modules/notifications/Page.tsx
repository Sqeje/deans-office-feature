import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/ui/primitives';
import { InlineError } from '../../shared/states';
import { useNotifications } from './state';
import { requestDetailsUrl } from '../requests/model';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});
const categories = { grade: 'Оценки', schedule: 'Расписание', request: 'Заявки', announcement: 'Объявления' };

export function NotificationContent({ compact = false }: { compact?: boolean }) {
  const { items, state, error, refresh, read, busy } = useNotifications();
  if (state === 'loading') return <p role="status">Загружаем уведомления…</p>;
  if (state === 'error') return <InlineError message={error || "Не удалось загрузить уведомления. Проверьте соединение и повторите попытку."} onRetry={() => void refresh()} />;
  if (!items.length) return <p>Уведомлений пока нет</p>;
  const sorted = [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <ul className={compact ? 'notification-list' : 'notifications-feed'}>
      {(compact ? sorted.slice(0, 3) : sorted).map(item => (
        <li key={item.id} className={!item.readAt ? 'notification-unread' : ''}>
          <Bell aria-hidden="true" />
          <div className="notification-body">
            <p className="notification-category">{categories[item.category as keyof typeof categories] ?? 'Уведомление'}</p>
            <h3>{item.title}</h3>
            <p className="muted">
              <time dateTime={item.createdAt}>{dateFormatter.format(new Date(item.createdAt))}</time> · Москва
            </p>
            <p>{!item.readAt ? 'Не прочитано' : 'Прочитано'}</p>
            {!compact && (
              <>
                <p>{item.text}</p>
                {item.relatedType === 'request' && item.relatedId && <p><Link to={requestDetailsUrl(item.relatedId)}>Открыть заявку</Link></p>}
                {!item.readAt && (
                  <Button variant="outline" disabled={busy} onClick={() => void read(item.id)}>Отметить прочитанным</Button>
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
      <NotificationContent compact />
      <Link to="/student/notifications">Все уведомления</Link>
    </section>
  );
}

export function Page() {
  const { unread, read, busy, error, state } = useNotifications();
  return (
    <div className="notifications-page">
      <PageHeader title="Уведомления" />
      {error && state !== 'error' && <InlineError message={error} />}
      <section className="card">
        <div className="notifications-toolbar">
          <p role="status">{unread === null ? 'Счётчик недоступен' : `Непрочитанных: ${unread}`}</p>
          <Button variant="outline" disabled={!unread || busy} onClick={() => void read()}>
            Отметить всё как прочитанное
          </Button>
        </div>
        <NotificationContent />
      </section>
    </div>
  );
}
