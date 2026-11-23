import { backendFetch } from "@/lib/api";
import type { DashboardResumen } from "./types";

export async function getDashboardResumen(params?: {
  desde?: string;
  hasta?: string;
}) {
  const search = new URLSearchParams();
  if (params?.desde) search.set("desde", params.desde);
  if (params?.hasta) search.set("hasta", params.hasta);

  const query = search.toString();
  return backendFetch<DashboardResumen>(`/dashboard${query ? `?${query}` : ""}`);
}