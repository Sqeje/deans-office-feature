import { useSession } from '../../shared/session';
import { useEffect, useState, useRef } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { client, check, csrf, ApiError } from '../../shared/api';
import { Button } from '../../components/ui/button';
import { SectionCard, StatusBadge } from '../../components/ui/primitives';
import { adapt, errorText, getDetail } from './api';
import { InputDetails, RequestHistoryView } from './Page';
import { requestStatuses, requestDate, type RequestRecord } from './model';
import './requests.css';

export function StaffPage() {
  const { session } = useSession();
  return <StaffRequests key={`${session?.universityId}/${session?.userId}`} />;
}
function StaffRequests() {
  const [params] = useSearchParams();
  const id = params.get('requestId');
  const generation = useRef(0), lock = useRef(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>();
  const [group, setGroup] = useState('');
  const [rows, setRows] = useState<RequestRecord[]>();
  const [record, setRecord] = useState<RequestRecord>();
  const [failure, setFailure] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  useEffect(() => {
    let active = true;
    client.GET('/api/requests/staff/groups').then(async result => {
      await check(result.response, result.error);
      if (active) {
        setGroups(result.data!);
        setGroup(previous => result.data!.some(g => g.id === previous) ? previous : result.data![0]?.id ?? '');
      }
    }).catch(error => { if (active) setFailure(error); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    const version = ++generation.current;
    let active = true;
    setBusy(false); lock.current = false;
    setRecord(undefined); setRows(undefined); setReason(''); setFailure(undefined);
    if (id) getDetail(id, true).then(row => { if (active) setRecord(row); }).catch(error => { if (active) setFailure(error); });
    else if (group) client.GET('/api/requests/staff', { params: { query: { groupId: group } } }).then(async result => {
      await check(result.response, result.error);
      if (active) setRows(result.data!.map(adapt));
    }).catch(error => { if (active) setFailure(error); });
    return () => { active = false; if (generation.current === version) generation.current++; };
  }, [id, group, attempt]);
  async function change(status: 'in_review' | 'ready' | 'rejected' | 'completed') {
    if (!record || lock.current) return;
    const version = generation.current;
    lock.current = true; setBusy(true); setFailure(undefined);
    try {
      const result = await client.POST('/api/requests/staff/{id}/status', {
        params: { path: { id: record.id } },
        body: { status, version: record.version!, rejectionReason: status === 'rejected' ? reason : null },
        headers: await csrf(),
      });
      await check(result.response, result.error);
      if (generation.current === version) {
        setRecord({ ...adapt(result.data!), studentName: record.studentName });
        setReason('');
      }
    } catch (error) { if (generation.current === version) setFailure(error); }
    finally { if (generation.current === version) { setBusy(false); lock.current = false; } }
  }
  if (failure instanceof ApiError && failure.status === 401) return <Navigate to="/login" state={{ expired: true }} replace />;
  return <section className="requests">
    <h1>Заявки</h1>
    {!!failure && <div role="alert"><p>{errorText(failure)}</p><Button onClick={() => setAttempt(x => x + 1)}>Обновить заявку</Button></div>}
    {id ? <>
      <Link to="/staff/requests">К списку</Link>
      {record ? <SectionCard title={record.title}>
        <p>Номер {record.number} · {record.studentName} · Подана {requestDate(record.submittedAt)}</p>
        <StatusBadge tone={requestStatuses[record.status].tone}>{record.status === 'ready' && <span aria-hidden="true">✓ </span>}{requestStatuses[record.status].label}</StatusBadge>
        <InputDetails input={record.input} /><RequestHistoryView record={record} />
        {record.status === 'submitted' ? <Button disabled={busy} onClick={() => void change('in_review')}>Взять на рассмотрение</Button>
          : record.status === 'in_review' ? <div className="request-processing">
            <Button disabled={busy} onClick={() => void change('ready')}>Отметить готовой</Button>
            <label htmlFor="rejection-reason">Причина отклонения</label>
            <textarea id="rejection-reason" maxLength={2000} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} />
            <Button disabled={busy || !reason.trim()} onClick={() => void change('rejected')}>Отклонить заявку</Button>
          </div> : record.status === 'ready' ? <div className="request-processing"><p>Документ готов к выдаче. Подтверждайте выполнение только после получения документа студентом или завершения обращения.</p><Button disabled={busy} onClick={() => void change('completed')}>Подтвердить выполнение и получение</Button></div> : <p role="status">Обработка завершена</p>}
        {busy && <p role="status">Сохраняем статус…</p>}
      </SectionCard> : !failure && <p role="status">Загружаем заявку…</p>}
    </> : groups ? groups.length ? <>
      <label htmlFor="request-group">Группа</label>
      <select id="request-group" value={group} onChange={e => setGroup(e.target.value)}>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
      {rows ? rows.length ? <ul className="request-list">{rows.map(row => <li className="card" key={row.id}>
        <Link to={`?requestId=${row.id}`}>Номер {row.number} · {row.title}</Link>
        <p>Подана {requestDate(row.submittedAt)}</p>
        <StatusBadge tone={requestStatuses[row.status].tone}>{requestStatuses[row.status].label}</StatusBadge>
      </li>)}</ul> : <p>Заявок пока нет</p> : !failure && <p role="status">Загружаем заявки…</p>}
    </> : <p>Нет доступных групп</p> : !failure && <p role="status">Загружаем группы…</p>}
  </section>;
}
