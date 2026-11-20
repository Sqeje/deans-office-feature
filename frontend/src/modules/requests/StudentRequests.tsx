import { liveSource, getDetail, errorText } from './api';
import { ApiError } from '../../shared/api';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../../shared/session';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FileText, Plus, Search, Info, CheckCircle2, Clock3, PackageCheck, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { StatusBadge, SectionCard } from '../../components/ui/primitives';
import { requestStatuses, requestDetailsUrl, requestDate, validateRequest, type RequestRecord, type RequestSource, type RequestInput } from './model';
import { requestGroups, requestType, requestTypes, type RequestType } from './catalog';
import './requests.css';

export function InputDetails({ input }: { input: RequestInput }) {
  return <dl className="request-details">
    {input.place && <><dt>Место предъявления</dt><dd>{input.place}</dd><dt>Количество экземпляров</dt><dd>{input.copies}</dd></>}
    {input.reason && <><dt>{input.place ? 'Комментарий обучающегося' : 'Причина'}</dt><dd>{input.reason}</dd></>}
    {input.start && input.end && <><dt>Период</dt><dd>{requestDate(input.start)} — {requestDate(input.end)}</dd></>}
  </dl>;
}
export function RequestStatusBadge({ status }: { status: RequestRecord['status'] }) {
  return <StatusBadge tone={requestStatuses[status].tone}>{(status === 'ready' || status === 'completed') && <CheckCircle2 size={15} aria-hidden="true" />}{requestStatuses[status].label}</StatusBadge>;
}
function TypeInformation({ type }: { type: RequestType }) {
  return <aside className="request-type-info" aria-label="О выбранной заявке">
    <div className="request-info-title"><Info size={20} aria-hidden="true" /><h3>Для чего эта заявка</h3></div>
    <p>{type.description}</p><dl><dt>Форма документа</dt><dd>{type.format}</dd><dt>Что подготовить</dt><dd>{type.documents}</dd></dl>
    <p className="request-muted">Срок рассмотрения, требования и способ получения уточняет учебный офис. Загрузка файлов в этом разделе пока недоступна.</p>
  </aside>;
}
function TypeCatalog({ kind, onSelect }: { kind: string; onSelect: (kind: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [help, setHelp] = useState(''); const [dismissed, setDismissed] = useState('');
  const [hovered, setHovered] = useState(''); const [focused, setFocused] = useState('');
  const visibleHelp = help || focused || hovered;
  useEffect(() => {
    function dismiss(event: KeyboardEvent) { if (event.key === 'Escape') { setDismissed(visibleHelp); setHelp(''); } }
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [visibleHelp]);
  return <aside className="request-catalog" aria-label="Каталог заявок">
    <button type="button" className="request-catalog-toggle" aria-expanded={expanded} aria-controls="request-catalog-content" onClick={() => setExpanded(!expanded)}>Каталог заявок<ChevronRight size={18} aria-hidden="true" /></button>
    <div id="request-catalog-content" className={`request-catalog-content ${expanded ? 'is-expanded' : ''}`}><h2>Каталог заявок</h2><p className="request-muted">Выберите категорию. Значок «i» расскажет о каждом обращении.</p>
    {requestGroups.map(group => <details key={group} className="request-category" open={group === requestType(kind).group ? true : undefined}>
      <summary>{group}<ChevronRight size={16} aria-hidden="true" /></summary>
      <ul>{requestTypes.filter(type => type.group === group).map(type => <li key={type.kind} className={kind === type.kind ? 'is-selected' : ''}>
        <button className="request-type-choice" type="button" aria-pressed={kind === type.kind} onClick={() => { setHelp(''); setExpanded(false); onSelect(type.kind); }}>{type.title}</button>
        <span className="request-help-wrap" onMouseEnter={() => { setHelp(''); setHovered(type.kind); setDismissed(''); }} onMouseLeave={() => setHovered('')}><button type="button" className="request-help" aria-label={`О заявке «${type.title}»`} aria-describedby={`help-${type.kind}`} aria-expanded={visibleHelp === type.kind && dismissed !== type.kind} onFocus={() => { setHelp(''); setFocused(type.kind); setDismissed(''); }} onBlur={() => setFocused('')} onClick={() => { setDismissed(help === type.kind ? type.kind : ''); setHelp(help === type.kind ? '' : type.kind); }}><Info size={18} aria-hidden="true" /></button>
          <span role="tooltip" id={`help-${type.kind}`} className={`request-tooltip ${visibleHelp === type.kind && dismissed !== type.kind ? 'is-open' : ''}`}><strong>{type.title}</strong><span>{type.description}</span><span>{type.format}</span></span>
        </span>
      </li>)}</ul>
    </details>)}</div>
  </aside>;
}
function RequestList({ records }: { records: RequestRecord[] }) {
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('all');
  const ready = records.filter(record => record.status === 'ready');
  const filtered = records.filter(record => (status === 'all' || record.status === status) && `${record.title} ${record.number} ${requestType(record.input.kind).group}`.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')));
  return <>
    <div className="request-overview" aria-label="Сводка заявок">
      <div><FileText aria-hidden="true" /><span>Всего заявок<strong>{records.length}</strong></span></div>
      <div><Clock3 aria-hidden="true" /><span>В работе<strong>{records.filter(record => ['submitted', 'in_review'].includes(record.status)).length}</strong></span></div>
      <div><PackageCheck aria-hidden="true" /><span>Ожидают получения<strong>{ready.length}</strong></span></div>
    </div>
    {!!ready.length && <aside className="request-ready-note"><PackageCheck size={24} aria-hidden="true" /><div><h2>Документы готовы к выдаче</h2><p>По {ready.length === 1 ? 'одной заявке документ ещё не получен' : `${ready.length} заявкам документы ещё не получены`}. Откройте заявку и уточните порядок получения в учебном офисе.</p><Link to={requestDetailsUrl(ready[0].id)}>Посмотреть готовую заявку</Link></div></aside>}
    <div className="request-toolbar"><div className="request-search"><Search size={18} aria-hidden="true" /><label className="sr-only" htmlFor="requests-search">Поиск заявок</label><input id="requests-search" type="search" placeholder="Название или номер заявки" value={search} onChange={event => setSearch(event.target.value)} /></div><div className="request-filter"><label htmlFor="requests-status">Статус</label><select id="requests-status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(requestStatuses).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></div></div>
    {!records.length ? <div className="request-empty"><FileText size={32} aria-hidden="true" /><h2>Заявок пока нет.</h2><p>Создайте заявку — её номер, статус и история появятся здесь.</p></div> : !filtered.length ? <div className="request-empty"><h2>Ничего не найдено</h2><p>Попробуйте другое название или сбросьте фильтры.</p><Button variant="outline" onClick={() => { setSearch(''); setStatus('all'); }}>Сбросить фильтры</Button></div> : <div className="request-register">
      <p className="request-muted" role="status">Найдено заявок: {filtered.length}</p>
      {requestGroups.map(group => { const rows = filtered.filter(record => requestType(record.input.kind).group === group); return rows.length ? <details className="request-register-group" key={group} open><summary>{group}<span>{rows.length}</span><ChevronRight size={17} aria-hidden="true" /></summary><div className="request-table-head" aria-hidden="true"><span>Тип заявки</span><span>Номер</span><span>Подана</span><span>Обновлена</span><span>Статус</span></div><ul className="request-register-rows">{rows.map(record => <li key={record.id} className="request-register-row"><div><Link to={requestDetailsUrl(record.id)}>{record.title}</Link>{record.status === 'ready' && <span className="request-row-note">Документ ещё не получен</span>}</div><div><span className="request-mobile-label">Номер</span>{record.number}</div><div><span className="request-mobile-label">Подана</span>{requestDate(record.submittedAt)}</div><div><span className="request-mobile-label">Обновлена</span>{requestDate(record.updatedAt ?? record.history?.at(-1)?.occurredAt ?? record.submittedAt)}</div><div><RequestStatusBadge status={record.status} /></div></li>)}</ul></details> : null; })}
    </div>}
  </>;
}
export function Page() { const { session } = useSession(); return <RequestsPage key={session ? `${session.universityId}/${session.userId}` : 'anonymous'} />; }
export function RequestsPage({ source = liveSource }: { source?: RequestSource }) {
  const [params, setParams] = useSearchParams(); const [records, setRecords] = useState<RequestRecord[]>();
  const [failure, setFailure] = useState<unknown>(); const [loadError, setLoadError] = useState(false); const [attempt, setAttempt] = useState(0);
  const [kind, setKind] = useState('certificate'); const [place, setPlace] = useState(''); const [copies, setCopies] = useState('1');
  const [reason, setReason] = useState(''); const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  const [review, setReview] = useState(false); const [confirmed, setConfirmed] = useState(''); const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState(false); const [busy, setBusy] = useState(false); const lock = useRef(false); const operation = useRef(crypto.randomUUID());
  const form = useRef<HTMLFormElement>(null); const heading = useRef<HTMLHeadingElement>(null);
  const create = params.get('view') === 'create'; const id = params.get('requestId'); const selected = records?.find(record => record.id === id); const type = requestType(kind);
  const input: RequestInput = type.fields === 'certificate' ? { kind, place, copies: +copies, ...(reason.trim() ? { reason } : {}) } : { kind, reason, ...(type.fields === 'period' ? { start, end } : {}) };
  useEffect(() => {
    let active = true; setLoadError(false); setFailure(undefined); setRecords(undefined);
    (id && source === liveSource ? getDetail(id).then(row => [row]) : source.load()).then(data => { if (active) setRecords(data); }).catch(error => { if (active) { setFailure(error); setLoadError(true); } });
    return () => { active = false; };
  }, [source, attempt, id]);
  useEffect(() => { heading.current?.focus(); }, [review, id, create, confirmed]);
  useEffect(() => { setReview(false); setErrors({}); setSendError(false); }, [create]);
  function choose(next: string) { setKind(next); setErrors({}); setSendError(false); setPlace(''); setCopies('1'); setReason(''); setStart(''); setEnd(''); }
  function validate() { const value = validateRequest(input); setErrors(value); if (Object.keys(value).length) { form.current?.querySelector<HTMLElement>(`[name="${Object.keys(value)[0]}"]`)?.focus(); return; } setReview(true); }
  async function confirm() {
    if (lock.current) return; lock.current = true; setBusy(true); setSendError(false);
    try {
      const operationId = params.get('operationId') ?? operation.current;
      if (source === liveSource) setParams({ view: 'create', operationId }, { replace: true });
      const record = await source.create(input, operationId); setRecords(current => [record, ...(current ?? [])]); setConfirmed(record.id); operation.current = crypto.randomUUID();
      setParams({ requestId: record.id }, { replace: true }); setPlace(''); setReason(''); setStart(''); setEnd(''); setCopies('1');
    } catch (error) { setFailure(error); setSendError(true); } finally { lock.current = false; setBusy(false); }
  }
  function field(name: string, label: string, control: ReactNode) { return <div className="request-field"><label htmlFor={`request-${name}`}>{label}</label>{control}{errors[name] && <p className="field-error" id={`error-${name}`}>{errors[name]}</p>}</div>; }
  function props(name: string) { return { id: `request-${name}`, name, 'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? `error-${name}` : undefined }; }
  if (failure instanceof ApiError && failure.status === 401) return <Navigate to="/login" state={{ expired: true }} replace />;
  return <section className="requests">
    <div className="request-page-heading"><div><h1 ref={heading} tabIndex={-1}>Заявки</h1><p className="request-muted">Справки и обращения в учебный офис</p></div>{!create && !id && <Button asChild><Link to="?view=create"><Plus size={18} aria-hidden="true" />Создать заявку</Link></Button>}</div>
    {source !== liveSource && <p className="request-demo">Демонстрационные данные.</p>}
    {create ? <>
      <Link className="request-back" to="/student/requests">К списку</Link><h2>{review ? 'Проверка данных' : 'Создать заявку'}</h2>
      <ol className="request-steps" aria-label="Этапы заявки"><li aria-current={!review ? 'step' : undefined}>Заполнение</li><li aria-current={review ? 'step' : undefined}>Проверка</li><li>Подтверждение</li></ol>
      {review ? <div className="request-review"><SectionCard title={type.title}><p className="request-muted">Проверьте данные перед отправкой. После подачи заявку увидит сотрудник учебного офиса.</p><InputDetails input={input} />{sendError && <p role="alert">{errorText(failure)} Данные сохранены в форме. Попробуйте ещё раз.</p>}<div className="request-actions"><Button disabled={busy} variant="outline" onClick={() => setReview(false)}>Редактировать</Button><Button disabled={busy} onClick={() => void confirm()}>{busy ? 'Отправляем…' : source === liveSource ? 'Отправить заявку' : 'Подтвердить демонстрацию'}</Button></div></SectionCard><TypeInformation type={type} /></div> : <div className="request-create-layout">
        <TypeCatalog kind={kind} onSelect={next => { choose(next); form.current?.querySelector<HTMLSelectElement>('#request-kind')?.focus(); }} /><div className="request-form-area"><form ref={form} className="request-form-card" noValidate onSubmit={event => { event.preventDefault(); validate(); }}>
          {field('kind', 'Вид заявки', <select {...props('kind')} value={kind} onChange={event => choose(event.target.value)}>{requestGroups.map(group => <optgroup key={group} label={group}>{requestTypes.filter(item => item.group === group).map(item => <option key={item.kind} value={item.kind}>{item.title}</option>)}</optgroup>)}</select>)}
          <div className="request-form-title"><FileText size={22} aria-hidden="true" /><h3>{type.title}</h3></div>
          <p className="request-form-description">{type.description}</p>
          {type.fields === 'certificate' ? <>{field('place', 'Место предъявления', <input {...props('place')} required maxLength={200} placeholder="Например, по месту требования" value={place} onChange={event => setPlace(event.target.value)} />)}{field('copies', 'Количество экземпляров (1–5)', <input {...props('copies')} type="number" min={1} max={5} step={1} required value={copies} onChange={event => setCopies(event.target.value)} />)}{field('reason', 'Комментарий обучающегося (необязательно)', <textarea {...props('reason')} maxLength={2000} placeholder="Особые требования получателя или уточнение к заявке" value={reason} onChange={event => setReason(event.target.value)} />)}</> : <>{field('reason', 'Причина', <textarea {...props('reason')} required maxLength={2000} placeholder="Опишите суть обращения и необходимые уточнения" value={reason} onChange={event => setReason(event.target.value)} />)}{type.fields === 'period' && <div className="request-period">{field('start', 'Начало периода', <input {...props('start')} required type="date" value={start} onChange={event => setStart(event.target.value)} />)}{field('end', 'Окончание периода', <input {...props('end')} required type="date" min={start} value={end} onChange={event => setEnd(event.target.value)} />)}</div>}</>}
          <p className="request-muted">Если нужны подтверждающие документы, сотрудник уточнит, как их передать.</p><div className="request-actions"><Button type="submit">Проверить</Button><Link to="/student/requests">Отмена</Link></div>
        </form><TypeInformation type={type} /></div>
      </div>}
    </> : loadError ? <div role="alert">{failure instanceof ApiError && failure.status === 404 && <h2>Заявка не найдена</h2>}<p>{errorText(failure)}</p><Button onClick={() => setAttempt(attempt + 1)}>Повторить</Button><Link to="/student">На главную</Link></div> : !records ? <div role="status" className="request-loading"><p>Загружаем заявки…</p><div className="skeleton-line" /><div className="skeleton-line" /></div> : id ? <>
      <Link className="request-back" to="/student/requests">К списку</Link>
      {confirmed === id && <div className="request-confirmation" role="status"><CheckCircle2 aria-hidden="true" /><div><h2>{source === liveSource ? 'Заявка отправлена' : 'Демонстрация подтверждена'}</h2><p>Номер {selected?.number}</p><Link to={requestDetailsUrl(id)} onClick={() => setConfirmed('')}>Открыть заявку</Link></div></div>}
      {selected ? <><SectionCard title={selected.title} className="request-detail-card"><div className="request-detail-meta"><p>Номер {selected.number} · Подана {requestDate(selected.submittedAt)}</p><RequestStatusBadge status={selected.status} /></div>
        {selected.status === 'ready' && <div className="request-ready-note"><PackageCheck size={25} aria-hidden="true" /><div><h3>Документ готов, но ещё не получен</h3><p>Обратитесь в учебный офис. Место и время выдачи уточните у сотрудника. После выдачи сотрудник отметит заявку выполненной.</p><Link to="/student/notifications">Открыть уведомления</Link></div></div>}
        {selected.status === 'completed' && <p className="request-completed-note"><CheckCircle2 size={20} aria-hidden="true" />Заявка выполнена. Получение документа или завершение обращения подтверждено сотрудником.</p>}
        <h3>Данные заявки</h3><InputDetails input={selected.input} /><RequestHistoryView record={selected} />{selected.rejectionReason && !selected.history?.length && <p>Причина отклонения: {selected.rejectionReason}</p>}{selected.result && <p>{selected.result}</p>}
      </SectionCard><TypeInformation type={requestType(selected.input.kind)} /></> : <h2>Заявка не найдена</h2>}
    </> : <RequestList records={records} />}
  </section>;
}
export function RequestHistoryView({ record }: { record: RequestRecord }) {
  return record.history ? <section className="request-history-section" aria-label="История заявки"><h3>История заявки</h3><ol className="request-history">{record.history.map((entry, index) => <li key={`${entry.occurredAt}-${index}`}><span className="request-history-marker" aria-hidden="true" /><div><strong>{requestStatuses[entry.status as keyof typeof requestStatuses]?.label ?? entry.status}</strong><p className="request-muted">{new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.occurredAt))} · {entry.author}</p>{entry.rejectionReason && <p>Причина отклонения: {entry.rejectionReason}</p>}</div></li>)}</ol></section> : null;
}


