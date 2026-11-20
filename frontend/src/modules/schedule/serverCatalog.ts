import { useEffect, useState } from "react";
import { client, check } from "../../shared/api";
import type { components } from "../../shared/schema";
import { toEvent } from "./api";
import type { EventSource } from "./model";
export type ServerCatalog = components["schemas"]["ScheduleCatalogDto"];
export function useServerCatalog() {
 const [data,setData]=useState<ServerCatalog>(); const [error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController(); client.GET("/api/schedule/catalog",{signal:controller.signal}).then(async r=>{await check(r.response,r.error);setData(r.data!);}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[]);
 return {data,error};
}
export const catalogSource: EventSource = async(query,signal)=>{
 const {data,response,error}=await client.GET("/api/schedule/catalog/events",{params:{query:{kind:query.entity.kind,id:query.entity.id,start:query.start,end:query.end,category:query.category}},signal});await check(response,error);return data!.map(toEvent);
};
