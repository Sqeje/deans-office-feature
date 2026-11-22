import { useEffect, useState } from "react";
import { client, check } from "../../shared/api";
import type { components } from "../../shared/schema";
import { toEvent } from "./api";
import type { EventSource } from "./model";
import { useSchedulePaths } from "./paths";

export type ServerCatalog = components["schemas"]["ScheduleCatalogDto"];
// Public reads remain public after logout or an account change in another tab.
const publicOptions = { credentials: "omit", headers: { "X-Dean-Account": "" } } as const;
export function useServerCatalog() {
  const { publicSchedule } = useSchedulePaths();
  const [data, setData] = useState<ServerCatalog>();
  const [error, setError] = useState<unknown>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined); setError(undefined);
    client.GET("/api/schedule/catalog", { signal: controller.signal, ...(publicSchedule ? publicOptions : {}) })
      .then(async result => { await check(result.response, result.error); if (!controller.signal.aborted) setData(result.data!); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause); });
    return () => controller.abort();
  }, [publicSchedule, attempt]);
  return { data, error, retry: () => setAttempt(value => value + 1) };
}
const source = (publicRead: boolean): EventSource => async (query, signal) => {
  const { data, response, error } = await client.GET("/api/schedule/catalog/events", {
    params: { query: { kind: query.entity.kind, id: query.entity.id, start: query.start, end: query.end, category: query.category } },
    signal, ...(publicRead ? publicOptions : {}),
  });
  await check(response, error);
  return data!.map(toEvent);
};
export const catalogSource = source(false);
export const publicCatalogSource = source(true);
