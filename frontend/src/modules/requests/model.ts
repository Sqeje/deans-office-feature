import type { components } from '../../shared/schema';
import { requestType, requestTypes } from './catalog';
export const requestStatuses = { submitted: { label: 'Отправлена', tone: 'neutral' }, in_review: { label: 'На рассмотрении', tone: 'success' }, ready: { label: 'Готова к выдаче', tone: 'success' }, completed: { label: 'Выполнена', tone: 'neutral' }, rejected: { label: 'Отклонена', tone: 'danger' } } as const satisfies Record<components['schemas']['RequestStatus'], { label: string; tone: 'neutral' | 'success' | 'danger' }>;
export type RequestStatus = components['schemas']['RequestStatus'];
export type RequestInput = { kind: string; place?: string; copies?: number; reason?: string; start?: string; end?: string };
export type RequestRecord = { id: string; number: string; title: string; status: RequestStatus; submittedAt: string; updatedAt?: string | null; input: RequestInput; rejectionReason?: string; result?: string; version?: number; studentName?: string | null; history?: { status: string; occurredAt: string; author: string; rejectionReason?: string | null }[] };
function calendarDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }
export function validateRequest(input: RequestInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!requestTypes.some(type => type.kind === input.kind)) errors.kind = 'Выберите вид заявки';
  const type = requestType(input.kind);
  if ((input.reason?.length ?? 0) > 2000) errors.reason = 'Не больше 2000 символов';
  if (type.fields === 'certificate') {
    if (!input.place?.trim()) errors.place = 'Укажите место предъявления'; else if (input.place.length > 200) errors.place = 'Не больше 200 символов';
    if (!Number.isInteger(input.copies) || !input.copies || input.copies < 1 || input.copies > 5) errors.copies = 'Укажите целое число от 1 до 5';
  } else {
    if (!input.reason?.trim()) errors.reason = 'Укажите причину';
    if (type.fields === 'period') {
      if (!calendarDate(input.start ?? '')) errors.start = 'Укажите начало периода';
      if (!calendarDate(input.end ?? '')) errors.end = 'Укажите окончание периода';
      else if (input.start && input.end && input.end < input.start) errors.end = 'Окончание не может быть раньше начала';
    }
  }
  return errors;
}
export type RequestSource = { load: () => Promise<RequestRecord[]>; create: (input: RequestInput, operationId?: string) => Promise<RequestRecord> };
export function requestDetailsUrl(id: string) { return `/student/requests?requestId=${encodeURIComponent(id)}`; }
export function requestDate(value: string) { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow' }).format(new Date(value)); }
