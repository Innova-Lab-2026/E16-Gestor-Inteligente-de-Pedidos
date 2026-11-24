import { cache } from "react";
import { cookies } from "next/headers";
import {
  EMPRENDIMIENTO_COOKIE,
  SESSION_COOKIE,
} from "@/features/auth/constants";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
};

type Emprendimiento = {
  id: string;
  nombre: string | null;
  rubro: string | null;
  especialidad: string | null;
  canales_venta: string[];
  modalidades_entrega: string[];
};

function parseEmprendimientos(value: unknown): Emprendimiento[] | null {
  if (!Array.isArray(value)) return null;

  const parsed: Emprendimiento[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const id = row.id ?? row.emprendimiento_id;
    if (typeof id !== "string") return null;

    parsed.push({
      id,
      nombre: typeof row.nombre === "string" ? row.nombre : null,
      rubro: typeof row.rubro === "string" ? row.rubro : null,
      especialidad:
        typeof row.especialidad === "string" ? row.especialidad : null,
      canales_venta: Array.isArray(row.canales_venta)
        ? row.canales_venta.filter(
            (channel): channel is string => typeof channel === "string",
          )
        : [],
      modalidades_entrega: Array.isArray(row.modalidades_entrega)
        ? row.modalidades_entrega.filter(
            (mode): mode is string => typeof mode === "string",
          )
        : [],
    });
  }
  return parsed;
}

const getEmprendimientos = cache(
  async (baseUrl: string, token: string): Promise<ApiResult<Emprendimiento[]>> => {
    try {
      const res = await fetch(`${baseUrl}/emprendimientos`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error:
            json?.error?.message ||
            json?.message ||
            "No pudimos cargar tus emprendimientos.",
        };
      }

      const data = parseEmprendimientos(json);
      if (!data) {
        return {
          ok: false,
          status: 502,
          data: null,
          error: "El servidor devolvió una lista de emprendimientos inválida.",
        };
      }

      return { ok: true, status: res.status, data };
    } catch {
      return {
        ok: false,
        status: 500,
        data: null,
        error: "No pudimos cargar tus emprendimientos.",
      };
    }
  },
);

function getBaseApiUrl(): string {
  const raw = process.env.BACKEND_API_URL?.replace(/\/+$/, "");
  if (!raw) {
    throw new Error("BACKEND_API_URL no está configurada.");
  }
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

export async function backendFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const baseUrl = getBaseApiUrl();
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (token && path.split("?")[0] !== "/emprendimientos") {
    const savedId = (await cookies()).get(EMPRENDIMIENTO_COOKIE)?.value;
    const emprendimientos = await getEmprendimientos(baseUrl, token);

    if (!emprendimientos.ok || !emprendimientos.data) {
      return {
        ok: false,
        status: emprendimientos.status,
        data: null,
        error: emprendimientos.error,
      };
    }

    const activeEmprendimiento =
      emprendimientos.data.find((item) => item.id === savedId) ??
      emprendimientos.data[0];

    if (!activeEmprendimiento) {
      return {
        ok: false,
        status: 409,
        data: null,
        error: "Creá un emprendimiento para empezar a usar la aplicación.",
      };
    }

    headers.set("x-emprendimiento-id", activeEmprendimiento.id);
  }

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error:
          json?.error?.message ||
          json?.message ||
          "Error al procesar la solicitud en el servidor.",
      };
    }

    if (
      path.split("?")[0] === "/emprendimientos" &&
      (!options.method || options.method.toUpperCase() === "GET")
    ) {
      const data = parseEmprendimientos(json);
      if (!data) {
        return {
          ok: false,
          status: 502,
          data: null,
          error: "El servidor devolvió una lista de emprendimientos inválida.",
        };
      }
      return { ok: true, status: res.status, data: data as T };
    }

    return { ok: true, status: res.status, data: json as T };
  } catch {
    return {
      ok: false,
      status: 500,
      data: null,
      error: "No pudimos conectar con el servidor. Intentá nuevamente.",
    };
  }
}