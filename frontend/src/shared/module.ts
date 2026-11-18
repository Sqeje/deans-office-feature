import type { ComponentType } from "react";
import type { components } from "./schema";
export type Area = "student" | "staff";
export interface ModulePage {
  area: Area;
  path: string;
  title: string;
  Page: ComponentType;
  navigationPath?: string;
  Navigation?: ComponentType;
  permission?: components["schemas"]["PermissionCode"];
}
export interface FrontendModule {
  id: string;
  pages: ModulePage[];
}
export function registerModules(modules: FrontendModule[]): ModulePage[] {
  if (new Set(modules.map((m) => m.id)).size !== modules.length)
    throw new Error("Duplicate frontend module");
  const pages = modules.flatMap((m) => m.pages);
  if (new Set(pages.map((p) => p.area + "/" + p.path)).size !== pages.length)
    throw new Error("Duplicate frontend route");
  return pages;
}
