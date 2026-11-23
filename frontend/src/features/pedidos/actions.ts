"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/lib/api";
import type {
  CreatePedidoManualInput,
  EstadoCobro,
  EstadoPedido,
  Pedido,
} from "./types";

export async function crearPedidoManualAction(input: CreatePedidoManualInput) {
  const res = await backendFetch<Pedido>("/pedidos", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (res.ok) {
    revalidatePath("/pedidos");
    revalidatePath("/catalogo");
  }

  return res;
}

export async function cambiarEstadoPedidoAction(
  id: string,
  estado: EstadoPedido,
  motivo?: string,
) {
  const res = await backendFetch<Pedido>(`/pedidos/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({
      estado,
      ...(motivo ? { motivo } : {}),
    }),
  });

  if (res.ok) {
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${id}`);
    if (estado === "CANCELADO") {
      revalidatePath("/catalogo");
    }
  }

  return res;
}

export async function cambiarCobroPedidoAction(
  id: string,
  estado_cobro: EstadoCobro,
) {
  const res = await backendFetch<Pedido>(`/pedidos/${id}/cobro`, {
    method: "PATCH",
    body: JSON.stringify({ estado_cobro }),
  });

  if (res.ok) {
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${id}`);
  }

  return res;
}

export async function resolverRevisionPedidoAction(
  id: string,
  requiereRevision: boolean,
  observaciones?: string,
) {
  const res = await backendFetch<Pedido>(`/pedidos/${id}/revision`, {
    method: "PATCH",
    body: JSON.stringify({
      requiereRevision,
      ...(observaciones ? { observaciones } : {}),
    }),
  });

  if (res.ok) {
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${id}`);
  }

  return res;
}