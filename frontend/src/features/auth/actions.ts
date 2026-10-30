"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/router";
import { SESSION_COOKIE } from "./constants";

export async function login(_previousState: { error?: string }, formData: FormData) {
  const apiUrl = process.env.API_URL?.replace(/\/+$/, "");
  if (!apiUrl) {
    return { error: "No pudimos conectar con el servidor. Intentá nuevamente." };
  }

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
  } catch {
    return { error: "No pudimos iniciar sesión. Intentá nuevamente." };
  }

  if (!res.ok) {
    // Supabase responde con el mismo error para un email inexistente y
    // una contraseña incorrecta; no podemos distinguirlos con seguridad.
    if (res.status === 401) {
      return { error: "El email o la contraseña son incorrectos." };
    }
    return { error: "No pudimos iniciar sesión. Intentá nuevamente." };
  }

  let token: unknown;
  try {
    token = (await res.json())?.access_token;
  } catch {
    return { error: "El servidor respondió con un formato inesperado." };
  }

  if (typeof token !== "string" || !token) {
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
