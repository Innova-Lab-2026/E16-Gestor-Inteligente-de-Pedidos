import { backendFetch } from "@/lib/api";
import type { Cliente, CreateClienteInput } from "./types";

export async function getClientes() {
  return backendFetch<Cliente[]>("/clientes");
}

export async function getClienteById(id: string) {
  return backendFetch<Cliente>(`/clientes/${id}`);
}

export async function createCliente(payload: CreateClienteInput) {
  return backendFetch<Cliente>("/clientes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCliente(
  id: string,
  payload: Partial<CreateClienteInput>,
) {
  return backendFetch<Cliente>(`/clientes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}