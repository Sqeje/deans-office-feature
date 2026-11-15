import { client, check, csrf, ApiError } from '../../shared/api';
import type { components } from '../../shared/schema';
export type Feed = components['schemas']['NotificationFeed'];
export async function load() {
  const r = await client.GET('/api/notifications/student'); await check(r.response, r.error); return r.data!;
}
export async function read(id?: string) {
  const headers = await csrf();
  const r = id ? await client.POST('/api/notifications/student/{id}/read', { params: { path: { id } }, headers })
    : await client.POST('/api/notifications/student/read-all', { headers });
  await check(r.response, r.error);
}
export async function publish(operationId: string, title: string, text: string) {
  const r = await client.POST('/api/notifications/staff/announcements', { body: { operationId, title, text }, headers: await csrf() });
  await check(r.response, r.error); return r.data!;
}
export function errorText(e: unknown) {
  const message = e instanceof ApiError && e.status === 403 ? 'Недостаточно прав.'
    : e instanceof ApiError && e.status === 401 ? 'Сеанс завершён. Войдите снова.'
    : e instanceof ApiError && e.status === 400 ? 'Проверьте введённые данные.'
    : e instanceof ApiError && e.status === 409 ? 'Содержимое повторной отправки изменилось. Начните новую публикацию.'
    : 'Не удалось выполнить запрос. Попробуйте ещё раз.';
  return message + (e instanceof ApiError && e.traceId ? ` Код обращения: ${e.traceId}` : '');
}
