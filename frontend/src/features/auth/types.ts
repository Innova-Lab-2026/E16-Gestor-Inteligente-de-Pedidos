export type Role = "admin" | "cliente";

export type Session = {
  userId: string;
  nombre: string;
  role: Role;
};