import { backendFetch } from "@/lib/api";
import type {
  CreatePedidoManualInput,
  EstadoCobro,
  EstadoPedido,
  Pedido,
} from "./types";

export async function getPedidos(filtros?: {
  estado?: EstadoPedido;
  requiere_revision?: boolean;
}) {
  const params = new URLSearchParams();
  if (filtros?.estado) params.set("estado", filtros.estado);
  if (filtros?.requiere_revision !== undefined) {
    params.set("requiere_revision", String(filtros.requiere_revision));
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  return backendFetch<Pedido[]>(`/pedidos${qs}`);
}

export async function getPedidoById(id: string) {
  return backendFetch<Pedido>(`/pedidos/${id}`);
}

export async function createPedidoManual(payload: CreatePedidoManualInput) {
  return backendFetch<Pedido>("/pedidos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEstadoPedido(
  id: string,
  estado: EstadoPedido,
  motivo?: string,
) {
  return backendFetch<Pedido>(`/pedidos/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado, ...(motivo ? { motivo } : {}) }),
  });
}

export async function updateCobroPedido(id: string, estado_cobro: EstadoCobro) {
  return backendFetch<Pedido>(`/pedidos/${id}/cobro`, {
    method: "PATCH",
    body: JSON.stringify({ estado_cobro }),
  });
}

export async function updateRevisionPedido(
  id: string,
  requiereRevision: boolean,
  observaciones?: string,
) {
  return backendFetch<Pedido>(`/pedidos/${id}/revision`, {
    method: "PATCH",
    body: JSON.stringify({ requiereRevision, observaciones }),
  });
}