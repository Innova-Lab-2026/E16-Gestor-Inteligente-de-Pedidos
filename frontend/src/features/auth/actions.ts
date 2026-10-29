"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/router";
import { SESSION_COOKIE } from "./constants";

export async function login(formData: FormData) {
  // Ajustar al contrato real del backend
  const res = await fetch(`${process.env.API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: formData.get("email"),
      password: formData.get("password"),
    }),
  });

  if (!res.ok) return { error: "Credenciales inválidas" };

  const { token } = await res.json();
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