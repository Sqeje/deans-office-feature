import type { components } from '../../shared/schema';
import { useSyncExternalStore } from 'react';
export const requestStatuses = { submitted: { label: 'Отправлена', tone: 'neutral' }, in_review: { label: 'На рассмотрении', tone: 'success' }, ready: { label: 'Готова', tone: 'success' }, rejected: { label: 'Отклонена', tone: 'danger' } } as const satisfies Record<components['schemas']['RequestStatus'], { label: string; tone: 'neutral' | 'success' | 'danger' }>;
export type RequestStatus = components['schemas']['RequestStatus'];
export type RequestInput = { kind: 'certificate'; place: string; copies: number } | { kind: 'statement'; reason: string; start: string; end: string };
export type RequestRecord = { id: string; number: string; title: string; status: RequestStatus; submittedAt: string; input: RequestInput; rejectionReason?: string; result?: string; version?: number; studentName?: string | null; history?: { status: string; occurredAt: string; author: string; rejectionReason?: string | null }[] };
function calendarDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }
export function validateRequest(input: RequestInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.kind === 'certificate') {
    if (!input.place.trim()) errors.place = 'Укажите место предъявления'; else if (input.place.length > 200) errors.place = 'Не больше 200 символов';
    if (!Number.isInteger(input.copies) || input.copies < 1 || input.copies > 5) errors.copies = 'Укажите целое число от 1 до 5';
  } else {
    if (!input.reason.trim()) errors.reason = 'Укажите причину'; else if (input.reason.length > 2000) errors.reason = 'Не больше 2000 символов';
    if (!calendarDate(input.start)) errors.start = 'Укажите начало периода';
    if (!calendarDate(input.end)) errors.end = 'Укажите окончание периода';
    else if (input.start && input.end < input.start) errors.end = 'Окончание не может быть раньше начала';
  }
  return errors;
}
export type RequestSource = { load: () => Promise<RequestRecord[]>; create: (input: RequestInput, operationId?: string) => Promise<RequestRecord> };
export function requestDetailsUrl(id: string) { return `/student/requests?requestId=${encodeURIComponent(id)}`; }
export function requestDate(value: string) { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow' }).format(new Date(value)); }
