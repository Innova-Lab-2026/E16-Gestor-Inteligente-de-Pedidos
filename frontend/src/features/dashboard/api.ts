import { backendFetch } from "@/lib/api";
import type { ResumenDashboard } from "./types";

export async function getResumenDashboard(rango?: {
  desde?: string;
  hasta?: string;
}) {
  const params = new URLSearchParams();
  if (rango?.desde) params.set("desde", rango.desde);
  if (rango?.hasta) params.set("hasta", rango.hasta);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return backendFetch<ResumenDashboard>(`/dashboard${qs}`);
}