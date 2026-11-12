import { useSyncExternalStore } from 'react';
export const requestStatuses = { submitted: { label: 'Отправлена', tone: 'neutral' }, in_review: { label: 'На рассмотрении', tone: 'success' }, ready: { label: 'Готова', tone: 'success' }, rejected: { label: 'Отклонена', tone: 'danger' } } as const;
export type RequestStatus = keyof typeof requestStatuses;
export type RequestInput = { kind: 'certificate'; place: string; copies: number } | { kind: 'statement'; reason: string; start: string; end: string };
export type DemoRequest = { id: string; number: string; title: string; status: RequestStatus; submittedAt: string; input: RequestInput; rejectionReason?: string; result?: string };
export const requestExamples: DemoRequest[] = [
  { id: 'demo-request-1', number: 'ДЕМО-1001', title: 'Перевод на индивидуальный график', status: 'in_review', submittedAt: '2026-11-06T09:00:00Z', input: { kind: 'statement', reason: 'Участие в учебном проекте', start: '2026-11-10', end: '2026-11-20' } },
  ...(['submitted', 'ready', 'rejected'] as const).map((status, i) => ({ id: `demo-request-${i + 2}`, number: `ДЕМО-${1002 + i}`, title: 'Справка об обучении', status, submittedAt: '2026-11-05T09:00:00Z', input: { kind: 'certificate' as const, place: 'По месту требования', copies: 1 }, ...(status === 'rejected' ? { rejectionReason: 'Уточните место предъявления справки.' } : {}), ...(status === 'ready' ? { result: 'Демонстрационный результат готов. Документ не выдаётся.' } : {}) }))
];
export function validateRequest(input: RequestInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.kind === 'certificate') {
    if (!input.place.trim()) errors.place = 'Укажите место предъявления'; else if (input.place.length > 200) errors.place = 'Не больше 200 символов';
    if (!Number.isInteger(input.copies) || input.copies < 1 || input.copies > 5) errors.copies = 'Укажите целое число от 1 до 5';
  } else {
    if (!input.reason.trim()) errors.reason = 'Укажите причину'; else if (input.reason.length > 2000) errors.reason = 'Не больше 2000 символов';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start)) errors.start = 'Укажите начало периода';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.end)) errors.end = 'Укажите окончание периода';
    else if (input.start && input.end < input.start) errors.end = 'Окончание не может быть раньше начала';
  }
  return errors;
}
export type DemoSource = { load: () => Promise<DemoRequest[]>; create: (input: RequestInput) => Promise<DemoRequest> };
let records = [...requestExamples]; let owner: string | undefined;
const listeners = new Set<() => void>(); const emit = () => listeners.forEach(f => f());
export function resetRequestSession(key: string | undefined) { if (owner !== key) { owner = key; records = [...requestExamples]; emit(); } }
export const demoSource: DemoSource = { async load() { return records; }, async create(input) { if (Object.keys(validateRequest(input)).length) throw new Error('validation'); const number = 1001 + records.length; const record: DemoRequest = { id: `demo-created-${number}`, number: `ДЕМО-${number}`, title: input.kind === 'certificate' ? 'Справка об обучении' : 'Заявление на индивидуальный график', status: 'submitted', submittedAt: new Date().toISOString(), input: input.kind === 'certificate' ? { ...input, place: input.place.trim() } : { ...input, reason: input.reason.trim() } }; records = [record, ...records]; emit(); return record; } };
export function useRequestSummary() { return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); } }, () => records[0]); }
export function requestDetailsUrl(id: string) { return `/student/requests?requestId=${encodeURIComponent(id)}`; }
export function requestDate(value: string) { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow' }).format(new Date(value)); }
