import { useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { PageHeader, SectionCard, TextAreaField, TextField } from '../../components/ui/primitives';
import { errorText, publish } from './api';
export function StaffPage() {
  const [title, setTitle] = useState(''), [text, setText] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(false);
  const operation = useRef<string | null>(null), lock = useRef(false);
  return <div className="notifications-page"><PageHeader title="Объявления" description="Сообщения для студентов вашего университета" /><SectionCard title="Новое объявление студентам университета">
    <p>После публикации объявление появится в ленте студентов вашего университета.</p>
    <form className="announcement-form" onSubmit={async event => {
      event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess(false);
      operation.current ??= crypto.randomUUID();
      try { await publish(operation.current, title, text); setSuccess(true); setTitle(''); setText(''); operation.current = null; }
      catch (e) { setError(errorText(e)); } finally { lock.current = false; setBusy(false); }
    }}>
      <TextField id="announcement-title" label="Заголовок" required maxLength={200} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} />
      <TextAreaField id="announcement-text" label="Текст объявления" required maxLength={4000} rows={6} value={text} disabled={busy} onChange={e => setText(e.target.value)} />
      {error && <p role="alert">{error}</p>}{success && <p role="status">Объявление опубликовано</p>}
      <Button pending={busy}>{busy ? 'Публикуем…' : 'Опубликовать'}</Button>
      {error && <Button type="button" variant="outline" disabled={busy} onClick={() => { operation.current = null; setError(''); }}>Начать новую публикацию</Button>}
    </form>
  </SectionCard></div>;
}
