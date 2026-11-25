import { backendFetch } from "@/lib/api";
import type { DashboardResumen } from "./types";

export async function getDashboardResumen(params?: {
  desde?: string;
  hasta?: string;
  fechaDespacho?: string;
}) {
  const search = new URLSearchParams();
  if (params?.desde) search.set("desde", params.desde);
  if (params?.hasta) search.set("hasta", params.hasta);
  if (params?.fechaDespacho) search.set("fechaDespacho", params.fechaDespacho);

  const query = search.toString();
  return backendFetch<DashboardResumen>(`/dashboard${query ? `?${query}` : ""}`);
}