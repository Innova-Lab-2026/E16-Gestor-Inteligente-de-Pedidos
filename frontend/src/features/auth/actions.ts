"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/router";
import { SESSION_COOKIE } from "./constants";

export async function login(_previousState: { error?: string }, formData: FormData) {
  let res: Response;
  try {
    res = await fetch(`${process.env.API_URL}/auth/login`, {
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

  const { access_token: token } = await res.json();
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
