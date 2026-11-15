import { useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { SectionCard } from '../../components/ui/primitives';
import { errorText, publish } from './api';
export function StaffPage() {
  const [title, setTitle] = useState(''), [text, setText] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(false);
  const operation = useRef<string | null>(null), lock = useRef(false);
  return <div className="notifications-page"><h1>Уведомления</h1><SectionCard title="Объявление студентам университета">
    <p>После публикации объявление появится в ленте студентов вашего университета.</p>
    <form className="announcement-form" onSubmit={async event => {
      event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess(false);
      operation.current ??= crypto.randomUUID();
      try { await publish(operation.current, title, text); setSuccess(true); setTitle(''); setText(''); operation.current = null; }
      catch (e) { setError(errorText(e)); } finally { lock.current = false; setBusy(false); }
    }}>
      <label htmlFor="announcement-title">Заголовок</label><input id="announcement-title" required maxLength={200} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} />
      <label htmlFor="announcement-text">Текст объявления</label><textarea id="announcement-text" required maxLength={4000} rows={6} value={text} disabled={busy} onChange={e => setText(e.target.value)} />
      {error && <p role="alert">{error}</p>}{success && <p role="status">Объявление опубликовано</p>}
      <Button disabled={busy}>{busy ? 'Публикуем…' : 'Опубликовать'}</Button>
      {error && <Button type="button" variant="outline" disabled={busy} onClick={() => { operation.current = null; setError(''); }}>Начать новую публикацию</Button>}
    </form>
  </SectionCard></div>;
}
