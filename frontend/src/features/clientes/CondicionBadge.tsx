import type { CondicionCliente } from "./types";

export const BADGE_CONDICION: Record<
  CondicionCliente,
  { label: string; className: string }
> = {
  OK: {
    label: "OK",
    className: "bg-emerald-100 text-emerald-800",
  },
  DEUDOR: {
    label: "Deudor",
    className: "bg-amber-100 text-amber-800",
  },
  IRRESPETUOSO: {
    label: "Irrespetuoso",
    className: "bg-orange-100 text-orange-800",
  },
  CANCELADOR: {
    label: "Cancelador",
    className: "bg-red-100 text-red-700",
  },
};

export default function CondicionBadge({
  condicion,
}: {
  condicion: CondicionCliente;
}) {
  const badge = BADGE_CONDICION[condicion] ?? BADGE_CONDICION.OK;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}
    >
      {badge.label === "OK" ? "Ok" : badge.label}
    </span>
  );
}
