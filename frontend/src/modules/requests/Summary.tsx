import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { client, check, ApiError } from '../../shared/api';
import { useSession } from '../../shared/session';
import { requestDetailsUrl, requestStatuses, requestDate } from './model';
import { errorText } from './api';
import type { components } from '../../shared/schema';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/primitives';

export function RequestSummary() {
  const { session } = useSession();
  const [row, setRow] = useState<components['schemas']['RequestDto'] | null>();
  const [failure, setFailure] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRow(undefined);
    setFailure(undefined);
    client.GET('/api/requests/student/summary').then(async result => {
      await check(result.response, result.error);
      if (active) setRow(result.data ?? null);
    }).catch(error => { if (active) setFailure(error); });
    return () => { active = false; };
  }, [session?.userId, session?.universityId, attempt]);
  if (failure instanceof ApiError && failure.status === 401)
    return <Navigate to="/login" state={{ expired: true }} replace />;
  return <section className="card request-card">
    <div className="summary-heading"><h2>Моя заявка</h2><Link to="/student/requests">Все заявки</Link></div>
    {failure ? <div role="alert"><p>{errorText(failure)}</p><Button onClick={() => setAttempt(x => x + 1)}>Повторить</Button></div>
      : row === undefined ? <p role="status">Загружаем заявку…</p>
      : row === null ? <p>Заявок пока нет. <Link to="/student/requests?view=create">Создать заявку</Link></p>
      : <><h3><Link to={requestDetailsUrl(row.id)}>{row.title}</Link></h3>
        <StatusBadge tone={requestStatuses[row.status].tone}>{row.status === 'ready' && <span aria-hidden="true">✓ </span>}{requestStatuses[row.status].label}</StatusBadge>
        <p>Номер {row.number} · Подана {requestDate(row.submittedAt)}</p></>}
  </section>;
}
