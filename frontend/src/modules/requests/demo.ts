import { useSyncExternalStore } from 'react';
import { validateRequest, type RequestRecord, type RequestSource } from './model';
export const requestExamples: RequestRecord[] = [
  { id: 'demo-request-1', number: 'ДЕМО-1001', title: 'Перевод на индивидуальный график', status: 'in_review', submittedAt: '2026-11-06T09:00:00Z', input: { kind: 'statement', reason: 'Участие в учебном проекте', start: '2026-11-10', end: '2026-11-20' } },
  ...(['submitted', 'ready', 'rejected'] as const).map((status, i) => ({ id: `demo-request-${i + 2}`, number: `ДЕМО-${1002 + i}`, title: 'Справка об обучении', status, submittedAt: '2026-11-05T09:00:00Z', input: { kind: 'certificate' as const, place: 'По месту требования', copies: 1 }, ...(status === 'rejected' ? { rejectionReason: 'Уточните место предъявления справки.' } : {}), ...(status === 'ready' ? { result: 'Демонстрационный результат готов. Документ не выдаётся.' } : {}) }))
];
let records = [...requestExamples]; let owner: string | undefined;
const listeners = new Set<() => void>(); const emit = () => listeners.forEach(f => f());
export function resetRequestSession(key: string | undefined) { if (owner !== key) { owner = key; records = [...requestExamples]; emit(); } }
export const demoSource: RequestSource = { async load() { return records; }, async create(input) { if (Object.keys(validateRequest(input)).length) throw new Error('validation'); const number = 1001 + records.length; const record: RequestRecord = { id: `demo-created-${number}`, number: `ДЕМО-${number}`, title: input.kind === 'certificate' ? 'Справка об обучении' : 'Заявление на индивидуальный график', status: 'submitted', submittedAt: new Date().toISOString(), input: input.kind === 'certificate' ? { ...input, place: input.place.trim() } : { ...input, reason: input.reason.trim() } }; records = [record, ...records]; emit(); return record; } };
export function useRequestSummary() { return useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); } }, () => records[0]); }
