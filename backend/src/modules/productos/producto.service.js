// modules/productos/producto.service.js
import { NotFoundError } from "../../errors/not-found.error.js";
import { BadRequestError } from "../../errors/bad-request.error.js";
import { ProductoDao } from "./producto.dao.js";
import { VarianteDao } from "../variantes/variante.dao.js";

export class ProductoService {
  constructor({ productoDao, varianteDao, token } = {}) {
    this.productoDao = productoDao || new ProductoDao(token);
    this.varianteDao = varianteDao || new VarianteDao(token);
  }

  async create(emprendimientoId, dto) {
    // dto viene con snake_case desde Zod
    const tieneVariantes = Boolean(dto.tiene_variantes);
    const stockDisponibleRaw = dto.stock_disponible;

    // Regla de negocio: Coherencia Stock/Variantes
    if (tieneVariantes) {
      if (stockDisponibleRaw !== undefined && stockDisponibleRaw !== null) {
        throw new BadRequestError(
          "Un producto con variantes no puede tener stock_disponible asignado.",
        );
      }
    } else {
      // Si NO tiene variantes, debe tener stock numérico (o default 0)
      // La constraint SQL exige NOT NULL, así que aseguramos un valor aquí.
      if (stockDisponibleRaw === undefined || stockDisponibleRaw === null) {
        // Opcional: Podrías tirar error si quieres forzar al usuario a poner stock.
        // Por ahora, usamos 0 como default seguro para cumplir la constraint.
      }
    }

    // Preparamos el payload para el DAO (también en snake_case para alinearlo con la DB)
    const payloadParaDao = {
      emprendimientoId,
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      precio: dto.precio,
      activo: dto.activo ?? true,

      // Valores ya validados y normalizados
      tiene_variantes: tieneVariantes,
      stock_disponible: tieneVariantes ? null : Number(stockDisponibleRaw) || 0,
      stock_minimo: Number(dto.stock_minimo) || 0,
      identificador_externo: dto.identificador_externo ?? null,
      sku_o_identificador: dto.sku_o_identificador ?? null,
    };

    return this.productoDao.create(payloadParaDao);
  }

  async list(emprendimientoId, opciones) {
    return this.productoDao.listByEmprendimiento(emprendimientoId, opciones);
  }

  async getById(emprendimientoId, id) {
    const producto = await this.productoDao.findById(emprendimientoId, id);
    if (!producto) throw new NotFoundError(`Producto ${id} no encontrado`);
    return producto;
  }

  async update(emprendimientoId, id, cambios) {
    await this.getById(emprendimientoId, id);

    // Lógica similar para update si cambia tiene_variantes
    // Por simplicidad, pasamos directo al DAO que hará el merge/update parcial
    // Asegurándonos de validar coherencia si ambos campos están presentes

    if (cambios.tiene_variantes !== undefined) {
      const tv = Boolean(cambios.tiene_variantes);
      if (
        tv &&
        cambios.stock_disponible !== undefined &&
        cambios.stock_disponible !== null
      ) {
        throw new BadRequestError(
          "No puedes establecer stock en un producto con variantes",
        );
      }
      if (!tv && cambios.stock_disponible === undefined) {
        // Si quita variantes, hay que asegurar stock.
        // El frontend debería mandar stock_disponible explícito.
        // Si no manda, podríamos mantener el existente o poner 0.
        // Aquí lo dejaremos pasar y la DB/Constraint lo manejará o dará error.
      }
    }

    return this.productoDao.update(emprendimientoId, id, cambios);
  }

  async resolveFromChannel(emprendimientoId, { identificadorExterno, nombre }) {
    // ... (mantenés este método igual que antes, usa camelCase interno del objeto devuelto por DAO)
    // Nota: El DAO devuelve snake_case desde Supabase.
    // Si tu código de resolución usa p.nombre, p.descripcion, etc., funciona porque esos campos son iguales.
    // Solo ojo con p.tiene_variantes vs p.tieneVariantes si accedes a eso.

    if (identificadorExterno) {
      const exacto = await this.productoDao.findByIdentificadorExterno(
        emprendimientoId,
        identificadorExterno,
      );
      if (exacto) return { producto: exacto, requiereRevision: false };
    }

    if (!nombre) {
      return {
        producto: null,
        requiereRevision: true,
        motivo: identificadorExterno
          ? `No se encontró el producto con identificador externo "${identificadorExterno}"`
          : "No se pudo identificar el producto en el mensaje",
      };
    }

    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const stopwords = new Set([
      "de",
      "del",
      "la",
      "el",
      "los",
      "las",
      "un",
      "una",
      "unos",
      "unas",
      "y",
      "o",
    ]);
    const tokensEntrada = norm(nombre)
      .split(" ")
      .filter((t) => t && !stopwords.has(t));

    if (tokensEntrada.length === 0) {
      return {
        producto: null,
        requiereRevision: true,
        motivo: "No se pudo identificar el producto en el mensaje",
      };
    }

    const productos = await this.productoDao.listByEmprendimiento(
      emprendimientoId,
      { soloActivos: true },
    );

    const candidatos = productos.filter((p) => {
      const texto = norm(`${p.nombre || ""} ${p.descripcion || ""}`);
      return tokensEntrada.every((tok) => texto.includes(tok));
    });

    if (candidatos.length === 1) {
      return { producto: candidatos[0], requiereRevision: false };
    }
    if (candidatos.length > 1) {
      return {
        producto: null,
        requiereRevision: true,
        motivo: `El texto "${nombre}" coincide con ${candidatos.length} productos`,
      };
    }

    return {
      producto: null,
      requiereRevision: true,
      motivo: identificadorExterno
        ? `No se encontró el producto con identificador externo "${identificadorExterno}"`
        : "No se pudo identificar el producto en el mensaje",
    };
  }
}

export default ProductoService;
