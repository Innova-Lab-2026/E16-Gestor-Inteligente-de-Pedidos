import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";
import type { Session } from "./types";

// cache() evita llamar al backend varias veces en un mismo request
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  if (process.env.AUTH_MOCK === "true") {
    if (token === "admin") return { userId: "1", nombre: "Admin Test", role: "admin" };
    if (token === "cliente") return { userId: "2", nombre: "Cliente Test", role: "cliente" };
    return null;
  }

  try {
    // Ajustar al endpoint real del backend
    const res = await fetch(`${process.env.API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Session;
  } catch {
    return null;
  }
});