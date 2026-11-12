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
  const value =
    problem ??
    (!response.bodyUsed ? await response.json().catch(() => ({})) : {});
  const p =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  throw new ApiError(
    response.status,
    typeof p.code === "string" ? p.code : "request_failed",
    typeof p.traceId === "string" ? p.traceId : undefined,
  );
}
export async function csrf() {
  const { data, response, error } = await client.GET("/api/identity/csrf");
  await check(response, error);
  if (!data) throw new Error("CSRF unavailable");
  return { "X-CSRF-TOKEN": data.token };
}
export const api = {
  async session(): Promise<Session | null> {
    const { data, response, error } = await client.GET("/api/identity/session");
    if (response.status === 401) return null;
    await check(response, error);
    return data!;
  },
  async me(): Promise<Profile | null> {
    const { data, response, error } = await client.GET("/api/identity/me");
    if (response.status === 401) return null;
    await check(response, error);
    return data!;
  },
  async login(email: string, password: string) {
    const { response, error } = await client.POST("/api/identity/login", {
      body: { email, password },
      headers: await csrf(),
    });
    await check(response, error);
  },
  async logout() {
    const { response, error } = await client.POST("/api/identity/logout", {
      headers: await csrf(),
    });
    await check(response, error);
  },
};
