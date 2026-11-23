"use server";

import { revalidatePath } from "next/cache";
import { createCliente, updateCliente } from "./api";
import type { CreateClienteInput } from "./types";

export async function crearClienteAction(input: CreateClienteInput) {
  const res = await createCliente(input);
  if (!res.ok) return { error: res.error };

  revalidatePath("/clientes");
  return { data: res.data };
}

export async function editarClienteAction(
  id: string,
  cambios: Partial<CreateClienteInput>,
) {
  const res = await updateCliente(id, cambios);
  if (!res.ok) return { error: res.error };

  revalidatePath("/clientes");
  return { data: res.data };
}