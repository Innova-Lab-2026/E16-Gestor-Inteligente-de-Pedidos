import { backendFetch } from "@/lib/api";
import type {
  CreatePedidoManualInput,
  EstadoCobro,
  EstadoPedido,
  Pedido,
} from "./types";

export async function getPedidos(filtros?: {
  estado?: EstadoPedido | EstadoPedido[];
  requiere_revision?: boolean;
  fecha_prevista_entrega?: string;
  desde?: string;
  hasta?: string;
  cliente_id?: string;
  cliente?: string;
  busqueda?: string;
  estado_cobro?: EstadoCobro;
  limite?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (Array.isArray(filtros?.estado)) {
    filtros.estado.forEach((estado) => params.append("estado", estado));
  } else if (filtros?.estado) {
    params.set("estado", filtros.estado);
  }
  if (filtros?.requiere_revision !== undefined) {
    params.set("requiere_revision", String(filtros.requiere_revision));
  }
  if (filtros?.fecha_prevista_entrega) {
    params.set("fecha_prevista_entrega", filtros.fecha_prevista_entrega);
  }
  if (filtros?.desde) params.set("desde", filtros.desde);
  if (filtros?.hasta) params.set("hasta", filtros.hasta);
  if (filtros?.cliente_id) params.set("cliente_id", filtros.cliente_id);
  if (filtros?.cliente) params.set("cliente", filtros.cliente);
  if (filtros?.busqueda) params.set("busqueda", filtros.busqueda);
  if (filtros?.estado_cobro) params.set("estado_cobro", filtros.estado_cobro);
  if (filtros?.limite) params.set("limite", String(filtros.limite));
  if (filtros?.offset !== undefined) params.set("offset", String(filtros.offset));
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