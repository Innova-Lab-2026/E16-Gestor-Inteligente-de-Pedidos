import type { Role } from "@/features/auth/types";

export const ROUTES = {
  login: "/login",
  registro: "/registro",
  home: "/dashboard",
} as const;

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/pedidos",
  "/catalogo",
  "/stock",
  "/clientes",
  "/configuracion",
];

export const ROLE_ACCESS: Record<string, Role[]> = {
  "/configuracion": ["admin"],
  "/stock": ["admin"],
  "/clientes": ["admin"],
};