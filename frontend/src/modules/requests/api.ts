import { client, check, csrf, ApiError } from '../../shared/api';
import type { components } from '../../shared/schema';
import type { RequestRecord, RequestInput, RequestSource } from './model';
export type ServerRequest = components['schemas']['RequestDto'];
export function adapt(x: ServerRequest): RequestRecord {
  return { ...x, input: x.input as RequestInput, status: x.status as RequestRecord['status'], rejectionReason: x.rejectionReason ?? undefined, history: x.history, version: Number(x.version) };
}
export async function getDetail(id: string, staff = false) {
  const result = staff ? await client.GET('/api/requests/staff/{id}', { params: { path: { id } } }) : await client.GET('/api/requests/student/{id}', { params: { path: { id } } });
  await check(result.response, result.error); return adapt(result.data!);
}
export const liveSource: RequestSource = {
  async load() { const r = await client.GET('/api/requests/student'); await check(r.response, r.error); return r.data!.map(adapt); },
  async create(input, operationId) { const r = await client.POST('/api/requests/student', { body: { operationId: operationId!, input }, headers: await csrf() }); await check(r.response, r.error); return adapt(r.data!); }
};
export function errorText(error: unknown) {
  if (error instanceof ApiError) return (error.status === 403 ? 'Нет доступа.' : error.status === 404 ? 'Заявка не найдена.' : error.status === 409 ? 'Данные изменились. Обновите заявку.' : error.status === 400 ? 'Проверьте поля заявки.' : 'Не удалось выполнить запрос. Попробуйте ещё раз.') + (error.traceId ? ` Код обращения: ${error.traceId}` : '');
  return 'Не удалось связаться с сервером. Попробуйте ещё раз.';
}
