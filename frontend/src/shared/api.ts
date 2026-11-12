import createClient from "openapi-fetch";
import type { paths, components } from "./schema";
export type Profile = components["schemas"]["ProfileResponse"];
export type Session = components["schemas"]["SessionResponse"];
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public traceId?: string,
  ) {
    super(code);
  }
}
export const client = createClient<paths>({
  baseUrl: "",
  credentials: "same-origin",
});
export async function check(response: Response, problem?: unknown) {
  if (response.ok) return;
  // openapi-fetch has already consumed error responses; reuse its parsed body.
  const p =
    problem ??
    (response.bodyUsed
      ? {}
      : await response
          .clone()
          .json()
          .catch(() => ({})));
  const details =
    typeof p === "object" && p !== null
      ? (p as { code?: string; traceId?: string })
      : {};
  throw new ApiError(
    response.status,
    details.code ?? "request_failed",
    details.traceId,
  );
}
export async function csrf() {
  const { data, error, response } = await client.GET("/api/identity/csrf");
  await check(response, error);
  if (!data) throw new Error("CSRF unavailable");
  return { "X-CSRF-TOKEN": data.token };
}
export const api = {
  async session(): Promise<Session | null> {
    const { data, error, response } = await client.GET("/api/identity/session");
    if (response.status === 401) return null;
    await check(response, error);
    return data!;
  },
  async me(): Promise<Profile | null> {
    const { data, error, response } = await client.GET("/api/identity/me");
    if (response.status === 401) return null;
    await check(response, error);
    return data!;
  },
  async login(email: string, password: string) {
    const { error, response } = await client.POST("/api/identity/login", {
      body: { email, password },
      headers: await csrf(),
    });
    await check(response, error);
  },
  async logout() {
    const { error, response } = await client.POST("/api/identity/logout", {
      headers: await csrf(),
    });
    await check(response, error);
  },
};
