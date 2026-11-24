"use server";

import { cookies } from "next/headers";
import { EMPRENDIMIENTO_COOKIE } from "@/features/auth/constants";
import { backendFetch } from "@/lib/api";
import type {
  CanalVenta,
  ModalidadEntrega,
} from "./constants";

export type Emprendimiento = {
  id: string;
  nombre: string | null;
  rubro: string | null;
  especialidad: string | null;
  canales_venta: CanalVenta[];
  modalidades_entrega: ModalidadEntrega[];
};

export type EmprendimientoInput = {
  nombre: string;
  rubro: string;
  especialidad: string | null;
  canales_venta: CanalVenta[];
  modalidades_entrega: ModalidadEntrega[];
};

export async function persistActiveEmprendimiento(id: string) {
  const { data, error } =
    await backendFetch<Emprendimiento[]>("/emprendimientos");

  if (!data) {
    return { error: error ?? "No pudimos validar el emprendimiento." };
  }

  if (!data.some((emprendimiento) => emprendimiento.id === id)) {
    return { error: "El emprendimiento seleccionado ya no está disponible." };
  }

  (await cookies()).set(EMPRENDIMIENTO_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return { ok: true };
}

export async function crearEmprendimientoAction(input: EmprendimientoInput) {
  const result = await backendFetch<Emprendimiento>("/emprendimientos", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!result.ok) {
    return { error: result.error ?? "No pudimos crear el emprendimiento." };
  }
  if (!result.data) {
    return { error: "El servidor no devolvió el emprendimiento creado." };
  }

  (await cookies()).set(EMPRENDIMIENTO_COOKIE, result.data.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return { data: result.data };
}

export async function actualizarEmprendimientoAction(
  id: string,
  input: EmprendimientoInput,
) {
  const result = await backendFetch<Emprendimiento>(
    `/emprendimientos/${id}`,
    {
      method: "PATCH",
      headers: { "x-emprendimiento-id": id },
      body: JSON.stringify(input),
    },
  );

  if (!result.ok) {
    return { error: result.error ?? "No pudimos actualizar el emprendimiento." };
  }
  if (!result.data) {
    return { error: "El servidor no devolvió el emprendimiento actualizado." };
  }

  return { data: result.data };
}
