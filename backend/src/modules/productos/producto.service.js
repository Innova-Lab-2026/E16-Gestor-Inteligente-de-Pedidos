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
    const tieneVariantes = Boolean(dto.tiene_variantes);
    const stockDisponibleRaw = dto.stock_disponible;

    if (tieneVariantes) {
      if (stockDisponibleRaw !== undefined && stockDisponibleRaw !== null) {
        throw new BadRequestError(
          "Un producto con variantes no puede tener stock_disponible asignado.",
        );
      }
    } else {
      if (stockDisponibleRaw === undefined || stockDisponibleRaw === null) {
      }
    }

    const payloadParaDao = {
      emprendimientoId,
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      precio: dto.precio,
      activo: dto.activo ?? true,
      tiene_variantes: tieneVariantes,
      stock_disponible: tieneVariantes ? null : Number(stockDisponibleRaw) || 0,
      stock_minimo: Number(dto.stock_minimo) || 0,
      identificador_externo: dto.identificador_externo ?? null,
      sku_o_identificador: dto.sku_o_identificador ?? null,
      // Nuevos campos del catálogo (migración 009)
      foto_url: dto.foto_url ?? null,
      marca: dto.marca ?? null,
      modelo: dto.modelo ?? null,
      genero: dto.genero ?? null,
      tipos_variante: dto.tipos_variante ?? [],
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
      }
    }

    return this.productoDao.update(emprendimientoId, id, cambios);
  }

  async resolveFromChannel(emprendimientoId, { identificadorExterno, nombre }) {
    const { normalizeText, esDenominacionMasEspecifica } = await import("../../utils/normalize.js");

    if (identificadorExterno) {
      const productos = await this.productoDao.listByEmprendimiento(
        emprendimientoId,
        { soloActivos: true },
      );
      const q = normalizeText(identificadorExterno);
      const exactosId = productos.filter((p) => {
        const sku = normalizeText(p.sku_o_identificador);
        const ext = normalizeText(p.identificador_externo);
        return (sku && sku === q) || (ext && ext === q);
      });
      if (exactosId.length === 1) {
        return { producto: exactosId[0], requiereRevision: false, estado: "resuelto", candidatos: exactosId };
      }
      if (exactosId.length > 1) {
        return {
          producto: null,
          requiereRevision: true,
          estado: "ambiguo",
          candidatos: exactosId,
          motivo: `El identificador "${identificadorExterno}" coincide con ${exactosId.length} productos`,
        };
      }
    }

    if (!nombre || !String(nombre).trim()) {
      return {
        producto: null,
        requiereRevision: true,
        estado: "faltante",
        candidatos: [],
        motivo: identificadorExterno
          ? `No se encontró el producto con identificador externo "${identificadorExterno}"`
          : "No se pudo identificar el producto en el mensaje",
      };
    }

    const productos = await this.productoDao.listByEmprendimiento(
      emprendimientoId,
      { soloActivos: true },
    );

    const q = normalizeText(nombre);

    const exactosNombre = productos.filter((p) => normalizeText(p.nombre) === q);
    if (exactosNombre.length === 1) {
      const hayMasEspecificos = productos.some((p) =>
        p.id !== exactosNombre[0].id &&
        esDenominacionMasEspecifica(exactosNombre[0].nombre, p.nombre),
      );
      if (hayMasEspecificos) {
        return {
          producto: null,
          requiereRevision: true,
          estado: "ambiguo",
          candidatos: productos.filter((p) =>
            esDenominacionMasEspecifica(exactosNombre[0].nombre, p.nombre) ||
            normalizeText(p.nombre) === q,
          ),
          motivo: `El nombre "${nombre}" es genérico frente a ${productos.filter((p) =>
            esDenominacionMasEspecifica(exactosNombre[0].nombre, p.nombre),
          ).length} denominación(es) más específica(s)`,
        };
      }
      return { producto: exactosNombre[0], requiereRevision: false, estado: "resuelto", candidatos: exactosNombre };
    }
    if (exactosNombre.length > 1) {
      return {
        producto: null,
        requiereRevision: true,
        estado: "ambiguo",
        candidatos: exactosNombre,
        motivo: `El nombre "${nombre}" coincide exactamente con ${exactosNombre.length} productos`,
      };
    }

    const exactosSku = productos.filter((p) => {
      const sku = normalizeText(p.sku_o_identificador);
      const ext = normalizeText(p.identificador_externo);
      return (sku && sku === q) || (ext && ext === q);
    });
    if (exactosSku.length === 1) {
      return { producto: exactosSku[0], requiereRevision: false, estado: "resuelto", candidatos: exactosSku };
    }
    if (exactosSku.length > 1) {
      return {
        producto: null,
        requiereRevision: true,
        estado: "ambiguo",
        candidatos: exactosSku,
        motivo: `El identificador "${nombre}" coincide con ${exactosSku.length} productos`,
      };
    }

    const sugerencias = productos.filter((p) => {
      const n = normalizeText(p.nombre);
      return n.includes(q) || q.includes(n);
    });
    return {
      producto: null,
      requiereRevision: true,
      estado: "inexistente",
      candidatos: sugerencias,
      motivo: identificadorExterno
        ? `No se encontró el producto con identificador externo "${identificadorExterno}"`
        : `No se encontró el producto "${nombre}"`,
    };
  }
}

export default ProductoService;
