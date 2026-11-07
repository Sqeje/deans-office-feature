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
async function check(response: Response) {
  if (response.ok) return;
  const p = await response
    .clone()
    .json()
    .catch(() => ({}));
  throw new ApiError(response.status, p.code ?? "request_failed", p.traceId);
}
async function csrf() {
  const { data, response } = await client.GET("/api/identity/csrf");
  await check(response);
  if (!data) throw new Error("CSRF unavailable");
  return { "X-CSRF-TOKEN": data.token };
}
export const api = {
  async session(): Promise<Session | null> {
    const { data, response } = await client.GET("/api/identity/session");
    if (response.status === 401) return null;
    await check(response);
    return data!;
  },
  async me(): Promise<Profile | null> {
    const { data, response } = await client.GET("/api/identity/me");
    if (response.status === 401) return null;
    await check(response);
    return data!;
  },
  async login(email: string, password: string) {
    const { response } = await client.POST("/api/identity/login", {
      body: { email, password },
      headers: await csrf(),
    });
    await check(response);
  },
  async logout() {
    const { response } = await client.POST("/api/identity/logout", {
      headers: await csrf(),
    });
    await check(response);
  },
};
