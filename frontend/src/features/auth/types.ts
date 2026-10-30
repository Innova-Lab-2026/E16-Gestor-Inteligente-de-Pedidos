export type Role = "admin" | "cliente";

export type Session = {
  // Backend response from GET /api/auth/me.
  id?: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  created_at?: string;
  // Kept for the optional local AUTH_MOCK flow and role guards.
  userId?: string;
  nombre?: string;
  role?: Role;
};
