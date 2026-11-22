import { z } from "zod";

export const createProductoSchema = z.object({
  nombre: z.string().trim().min(1).max(150),
  descripcion: z.string().trim().max(2000).optional(),
  precio: z.coerce.number().positive(),
  activo: z.boolean().default(true),

  // Claves snake_case para coincidir con el request JSON y la DB
  tiene_variantes: z.boolean().default(false),
  stock_disponible: z.coerce.number().int().min(0).nullable().optional(),
  stock_minimo: z.coerce.number().int().min(0).default(0),
  identificador_externo: z.string().trim().max(100).optional(),
  sku_o_identificador: z.string().trim().max(100).optional(),
  // Nuevos campos del catálogo (migración 009)
  foto_url: z.string().url().optional().nullable(),
  marca: z.string().trim().max(100).optional().nullable(),
  modelo: z.string().trim().max(100).optional().nullable(),
  genero: z.string().trim().max(30).optional().nullable(),
  tipos_variante: z.array(z.string()).optional().default([]),
});

export const updateProductoSchema = z.object({
  nombre: z.string().trim().min(1).max(150).optional(),
  descripcion: z.string().trim().max(2000).optional(),
  precio: z.coerce.number().positive().optional(),
  activo: z.boolean().optional(),
  tiene_variantes: z.boolean().optional(),
  stock_disponible: z.coerce.number().int().min(0).nullable().optional(),
  stock_minimo: z.coerce.number().int().min(0).optional(),
  identificador_externo: z.string().trim().max(100).optional(),
  sku_o_identificador: z.string().trim().max(100).optional(),
  // Nuevos campos del catálogo (migración 009)
  foto_url: z.string().url().optional().nullable(),
  marca: z.string().trim().max(100).optional().nullable(),
  modelo: z.string().trim().max(100).optional().nullable(),
  genero: z.string().trim().max(30).optional().nullable(),
  tipos_variante: z.array(z.string()).optional(),
});
