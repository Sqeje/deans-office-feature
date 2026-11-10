export function Icon({name}:{name:string}) {
 const paths:Record<string,React.ReactNode>={
 home:<><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/></>,
 calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></>,
 chart:<path d="M5 20V10m7 10V4m7 16V8"/>,
 document:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/></>,
 bell:<><path d="M5 16V10a7 7 0 0 1 14 0v6l2 3H3Zm5 6h4"/></>,
 layers:<><path d="m3 8 9-5 9 5-9 5Zm0 8 9 5 9-5m-18-4 9 5 9-5"/></>,
 check:<path d="m4 12 5 5L20 6"/>,
 alert:<><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4v.01"/></>,
 user:<><circle cx="12" cy="7" r="4"/><path d="M4 22v-5a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v5"/></>,
 cap:<><path d="m2 8 10-5 10 5-10 5ZM6 10v7q6 5 12 0v-7m4-2v9"/></>,
 code:<path d="m7 6-5 6 5 6m10-12 5 6-5 6m-4-14-2 16"/>,
 chat:<path d="M21 11a9 8 0 0 1-9 8H5l-3 3 1-7a8 8 0 1 1 18-4Z"/>,
 arrow:<path d="m9 5 7 7-7 7"/>,back:<path d="m10 5-7 7 7 7M3 12h18"/>,down:<path d="m5 9 7 7 7-7"/>
 };
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]??paths.document}</svg>;
}

