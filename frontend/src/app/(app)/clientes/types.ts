export type CondicionCliente =
  | "OK"
  | "DEUDOR"
  | "IRRESPETUOSO"
  | "CANCELADOR";

export type Cliente = {
  id: string;
  emprendimiento_id: string;
  nombre: string;
  apellido?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  observaciones?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  email?: string | null;
  foto_url?: string | null;
  condicion: CondicionCliente;
  created_at?: string;
};

export type CreateClienteInput = {
  nombre: string;
  apellido?: string;
  telefono?: string;
  direccion?: string;
  observaciones?: string;
  tipo_documento?: string;
  numero_documento?: string;
  email?: string;
  condicion?: CondicionCliente;
};