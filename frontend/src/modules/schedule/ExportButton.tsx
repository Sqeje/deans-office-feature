import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { ScheduleExport } from "./export";

export function ExportButton({ ready, schedule }: { ready: boolean; schedule: ScheduleExport }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function save() {
    if (!ready || pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailed(false);
    try {
      // Load the XLSX writer only on demand, not with the schedule's initial bundle.
      const { buildScheduleXlsx, downloadSchedule } = await import("./export");
      const file = await buildScheduleXlsx(schedule);
      if (mounted.current) downloadSchedule(file);
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <div className="schedule-export">
    <Button type="button" variant="outline" className="schedule-export-button"
      disabled={!ready || busy} aria-busy={busy} onClick={() => void save()}>
      <Download aria-hidden="true" /><span>{busy ? "Сохраняем…" : "Сохранить на устройство"}</span>
    </Button>
    {failed && <p role="alert">Не удалось сохранить XLSX. Попробуйте ещё раз.</p>}
  </div>;
}
