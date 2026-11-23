"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/router";
import { SESSION_COOKIE } from "./constants";

export type LoginState = { error?: string };

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const apiUrl = process.env.BACKEND_API_URL?.replace(/\/+$/, "");

  if (!apiUrl) {
    return { error: "No pudimos conectar con el servidor. Intentá nuevamente." };
  }

  let res: Response;

  try {
    res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[LOGIN] Error de conexión:", error);
    return { error: "No pudimos iniciar sesión. Intentá nuevamente." };
  }

  let data: {
    access_token?: string;
    user?: {
      id: string;
      email: string;
    };
    message?: string;
  };

  try {
    data = await res.json();
  } catch (error) {
    console.error("[LOGIN] Respuesta JSON inválida:", error);
    return { error: "El servidor respondió con un formato inesperado." };
  }

  if (!res.ok) {
    console.error("[LOGIN] Error HTTP:", res.status, data);

    if (res.status === 401) {
      return { error: "El email o la contraseña son incorrectos." };
    }

    return {
      error: data.message || "No pudimos iniciar sesión. Intentá nuevamente.",
    };
  }

  const token = data.access_token;

  if (typeof token !== "string" || !token) {
    console.error("[LOGIN] No se recibió access_token:", data);
    return { error: "El servidor no devolvió una sesión válida." };
  }

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect(ROUTES.home);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect(ROUTES.login);
}