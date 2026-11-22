import { useSession } from '../../shared/session';
import { useEffect, useState, useRef } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { client, check, csrf, ApiError } from '../../shared/api';
import { Button } from '../../components/ui/button';
import { PageHeader, SectionCard, StatusBadge } from '../../components/ui/primitives';
import { ErrorPanel } from '../../shared/states';
import { adapt, errorText, getDetail } from './api';
import { InputDetails, RequestHistoryView } from './Page';
import { requestStatuses, requestDate, type RequestRecord } from './model';
import './requests.css';

export function StaffPage() {
  const { session } = useSession();
  return <StaffRequests key={`${session?.universityId}/${session?.userId}`} />;
}
function StaffRequests() {
  const [params, setParams] = useSearchParams();
  const id = params.get('requestId');
  const group = params.get('groupId') ?? '';
  const search = params.get('q') ?? '';
  const status = params.get('status') ?? 'all';
  const groupRef = useRef(group);
  groupRef.current = group;
  const generation = useRef(0), lock = useRef(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>();
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
        const requestedGroup = groupRef.current;
        if (!result.data!.some(g => g.id === requestedGroup) && result.data![0]) {
          setParams(current => {
            const next = new URLSearchParams(current);
            next.set('groupId', result.data![0].id);
            return next;
          }, { replace: true });
        }
      }
    }).catch(error => { if (active) setFailure(error); });
    return () => { active = false; };
  }, [attempt, setParams]);
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
  const normalize = (value: string) => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
  const orderedRows = [...(rows ?? [])].sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
  const isActionRequired = (row: RequestRecord) => row.status === 'submitted' || row.status === 'in_review';
  const matchesSearch = (row: RequestRecord) => !search.trim() || normalize(`${row.title} ${row.number} ${row.studentName ?? ''}`).includes(normalize(search.trim()));
  const actionRows = orderedRows.filter(row => isActionRequired(row) && matchesSearch(row) && (status === 'all' || status === 'action'));
  const processedRows = orderedRows.filter(row => !isActionRequired(row) && matchesSearch(row) && (status === 'all' || status === 'processed'));
  const resultCount = actionRows.length + processedRows.length;
  function updateListFilter(key: 'q' | 'status', value: string) {
    setParams(current => {
      const next = new URLSearchParams(current);
      next.delete('requestId');
      if (value && (key !== 'status' || value !== 'all')) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }
  function detailUrl(requestId: string) {
    const next = new URLSearchParams(params);
    next.set('groupId', group);
    next.set('requestId', requestId);
    return `/staff/requests?${next.toString()}`;
  }
  const listParams = new URLSearchParams(params);
  listParams.delete('requestId');
  const listQuery = listParams.toString();
  const listUrl = `/staff/requests${listQuery ? `?${listQuery}` : ''}`;
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
    <PageHeader title="Заявки" />
    {!!failure && <ErrorPanel title="Не удалось выполнить запрос" message={errorText(failure)} onRetry={failure instanceof ApiError && failure.status === 403 ? undefined : () => setAttempt(x => x + 1)} />}
    {id ? <>
      <Link className="request-back" to={listUrl}>К списку заявок</Link>
      {record ? <SectionCard title={record.title}>
        <p>Номер {record.number} · {record.studentName} · Подана {requestDate(record.submittedAt)}</p>
        <StatusBadge tone={requestStatuses[record.status].tone}>{record.status === 'ready' && <span aria-hidden="true">✓ </span>}{requestStatuses[record.status].label}</StatusBadge>
        <InputDetails input={record.input} /><RequestHistoryView record={record} />
        {record.status === 'submitted' ? <Button pending={busy} onClick={() => void change('in_review')}>Взять на рассмотрение</Button>
          : record.status === 'in_review' ? <div className="request-processing">
            <Button pending={busy} onClick={() => void change('ready')}>Отметить готовой</Button>
            <label htmlFor="rejection-reason">Причина отклонения</label>
            <textarea id="rejection-reason" maxLength={2000} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} />
            <Button variant="danger" pending={busy} disabled={!reason.trim()} onClick={() => void change('rejected')}>Отклонить заявку</Button>
          </div> : record.status === 'ready' ? <div className="request-processing"><p>Документ готов к выдаче. Подтверждайте выполнение только после получения документа студентом или завершения обращения.</p><Button pending={busy} onClick={() => void change('completed')}>Подтвердить выполнение и получение</Button></div> : <p role="status">Обработка завершена</p>}
        {busy && <p role="status">Сохраняем статус…</p>}
      </SectionCard> : !failure && <p role="status">Загружаем заявку…</p>}
    </> : groups ? groups.length ? <>
      <div className="request-staff-toolbar">
        <label className="request-staff-group" htmlFor="request-group">Группа
          <select id="request-group" value={group} onChange={e => setParams(current => { const next = new URLSearchParams(current); next.set('groupId', e.target.value); next.delete('requestId'); return next; })}>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        </label>
        <label className="request-staff-search" htmlFor="request-search"><span>Поиск</span><span className="request-search-control"><Search size={18} aria-hidden="true" /><input id="request-search" type="search" value={search} onChange={e => updateListFilter('q', e.target.value)} placeholder="Заявка, номер или студент" /></span></label>
        <label className="request-staff-status" htmlFor="request-status">Статус
          <select id="request-status" value={status} onChange={e => updateListFilter('status', e.target.value)}><option value="all">Все</option><option value="action">Требуют действия</option><option value="processed">Обработанные</option></select>
        </label>
      </div>
      {rows ? rows.length ? <>
        <p className="request-staff-count" role="status">Найдено заявок: {resultCount}</p>
        {(status === 'all' || status === 'action') && <RequestQueue title="Требуют действия" rows={actionRows} detailUrl={detailUrl} empty="Заявок, требующих действия, нет." />}
        {(status === 'all' || status === 'processed') && <RequestQueue title="Обработанные" rows={processedRows} detailUrl={detailUrl} empty="Обработанных заявок пока нет." />}
        {!resultCount && <div className="request-empty"><h2>Ничего не найдено</h2><p>Измените поиск или фильтр статуса.</p><Button variant="outline" onClick={() => setParams(current => { const next = new URLSearchParams(current); next.delete('q'); next.delete('status'); return next; }, { replace: true })}>Сбросить фильтры</Button></div>}
      </> : <p>Заявок пока нет.</p> : !failure && <p role="status">Загружаем заявки…</p>}
    </> : <p>Нет доступных групп</p> : !failure && <p role="status">Загружаем группы…</p>}
  </section>;
}

function RequestQueue({ title, rows, detailUrl, empty }: { title: string; rows: RequestRecord[]; detailUrl: (id: string) => string; empty: string }) {
  return <SectionCard title={title} action={<span className="request-queue-count" aria-label={`${rows.length} заявок`}>{rows.length}</span>}>
    {rows.length ? <div className="request-staff-table-wrap"><table className="request-staff-table">
      <thead><tr><th scope="col">Заявка</th><th scope="col">Студент</th><th scope="col">Номер</th><th scope="col">Подана</th><th scope="col">Статус</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td data-label="Заявка"><Link to={detailUrl(row.id)}>{row.title}</Link></td>
        <td data-label="Студент">{row.studentName || "Студент"}</td>
        <td data-label="Номер">{row.number}</td>
        <td data-label="Подана">{requestDate(row.submittedAt)}</td>
        <td data-label="Статус"><StatusBadge tone={requestStatuses[row.status].tone}>{requestStatuses[row.status].label}</StatusBadge></td>
      </tr>)}</tbody>
    </table></div> : <p className="request-queue-empty">{empty}</p>}
  </SectionCard>;
}
