"use server";

import { revalidatePath } from "next/cache";
import {
  createProducto,
  createVarianteProducto,
  registrarMovimientoStock,
  updateProducto,
  updateVarianteProducto,
} from "./api";
import type {
  AjustarStockInput,
  CreateProductoInput,
  CreateVarianteInput,
  UpdateVarianteInput,
} from "./types";

export async function crearProductoAction(input: CreateProductoInput) {
  const res = await createProducto(input);
  if (!res.ok) return { error: res.error };

  revalidatePath("/catalogo");
  return { data: res.data };
}

export async function editarProductoAction(
  id: string,
  cambios: Partial<CreateProductoInput>,
) {
  const res = await updateProducto(id, cambios);
  if (!res.ok) return { error: res.error };

  revalidatePath("/catalogo");
  revalidatePath(`/catalogo/${id}`);
  return { data: res.data };
}

export async function agregarVarianteAction(
  productoId: string,
  input: CreateVarianteInput,
) {
  const res = await createVarianteProducto(productoId, input);
  if (!res.ok) return { error: res.error };

  revalidatePath("/catalogo");
  revalidatePath(`/catalogo/${productoId}`);
  return { data: res.data };
}

export async function editarVarianteAction(
  productoId: string,
  varianteId: string,
  cambios: UpdateVarianteInput,
) {
  const res = await updateVarianteProducto(varianteId, cambios);
  if (!res.ok) return { error: res.error };

  revalidatePath("/catalogo");
  revalidatePath(`/catalogo/${productoId}`);
  return { data: res.data };
}

export async function ajustarStockAction(input: AjustarStockInput) {
  const res = await registrarMovimientoStock(input);
  if (!res.ok) return { error: res.error };

  revalidatePath("/catalogo");
  revalidatePath(`/catalogo/${input.producto_id}`);
  return { ok: true };
}
