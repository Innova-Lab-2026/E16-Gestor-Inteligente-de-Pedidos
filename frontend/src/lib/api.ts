import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/features/auth/constants";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
};

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