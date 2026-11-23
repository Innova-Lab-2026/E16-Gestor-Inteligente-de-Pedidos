import { backendFetch } from "@/lib/api";
import type {
  AjustarStockInput,
  CreateProductoInput,
  CreateVarianteInput,
  Producto,
  UpdateVarianteInput,
  Variante,
} from "./types";

export async function getProductos(incluirInactivos = true) {
  const query = incluirInactivos ? "?incluirInactivos=true" : "";
  return backendFetch<Producto[]>(`/productos${query}`);
}

export async function getProductoById(id: string) {
  return backendFetch<Producto>(`/productos/${id}`);
}

export async function createProducto(payload: CreateProductoInput) {
  return backendFetch<Producto>("/productos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProducto(
  id: string,
  payload: Partial<CreateProductoInput>,
) {
  return backendFetch<Producto>(`/productos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getVariantesProducto(productoId: string) {
  return backendFetch<Variante[]>(`/productos/${productoId}/variantes`);
}

export async function createVarianteProducto(
  productoId: string,
  payload: CreateVarianteInput,
) {
  return backendFetch<Variante>(`/productos/${productoId}/variantes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateVarianteProducto(
  varianteId: string,
  payload: UpdateVarianteInput,
) {
  return backendFetch<Variante>(`/variantes/${varianteId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function registrarMovimientoStock(payload: AjustarStockInput) {
  return backendFetch("/stock/movimientos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}