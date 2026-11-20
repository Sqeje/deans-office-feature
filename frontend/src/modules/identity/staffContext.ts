import { client, check } from "../../shared/api";
export async function loadStaffContext(signal: AbortSignal) {
  const { data, error, response } = await client.GET("/api/identity/staff-context", { signal });
  await check(response, error);
  return data!;
}
