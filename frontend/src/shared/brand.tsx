import { GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
export function Brand({ to = "/", onClick }: { to?: string; onClick?: () => void }) {
  return (
    <Link to={to} className="brand" onClick={onClick}>
      <span className="brand-mark">
        <GraduationCap aria-hidden="true" />
      </span>
      Деканат
    </Link>
  );
}
export function PrototypeNotice() {
  return (
    <p className="prototype-notice">Конкурсный концепт, не официальный сайт</p>
  );
}
