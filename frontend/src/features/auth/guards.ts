import { redirect } from "next/navigation";
import { ROUTES } from "@/config/router";
import { getSession } from "./session";
import type { Role } from "./types";

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect(ROUTES.login);
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect(ROUTES.home);
  return session;
}
