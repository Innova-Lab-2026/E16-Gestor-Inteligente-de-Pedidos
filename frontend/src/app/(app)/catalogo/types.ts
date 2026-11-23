export type Variante = {
  id: string;
  producto_id: string;
  nombre: string;
  stock_disponible: number;
  stock_minimo: number;
  activo: boolean;
  atributos: Record<string, string>;
};

export type Producto = {
  id: string;
  emprendimiento_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activo: boolean;
  tiene_variantes: boolean;
  stock_disponible: number | null;
  stock_minimo: number;
  foto_url: string | null;
  marca: string | null;
  modelo: string | null;
  genero: string | null;
  tipos_variante: string[];
  variantes?: Variante[];
};

export type CreateProductoInput = {
  nombre: string;
  descripcion?: string;
  precio: number;
  activo?: boolean;
  tiene_variantes?: boolean;
  stock_disponible?: number | null;
  stock_minimo?: number;
  foto_url?: string | null;
  marca?: string | null;
  modelo?: string | null;
  genero?: string | null;
  tipos_variante?: string[];
};

export type CreateVarianteInput = {
  nombre: string;
  stock_disponible: number;
  stock_minimo?: number;
  atributos?: Record<string, string>;
};

export type UpdateVarianteInput = {
  nombre?: string;
  stock_minimo?: number;
  activo?: boolean;
  atributos?: Record<string, string>;
};

export type TipoMovimientoStock =
  | "REPOSICION"
  | "PRODUCCION"
  | "PERDIDA"
  | "CORRECCION_MANUAL";

export type AjustarStockInput = {
  producto_id: string;
  variante_id?: string | null;
  tipo: TipoMovimientoStock;
  cantidad: number;
  motivo?: string;
};