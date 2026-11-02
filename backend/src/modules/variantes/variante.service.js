import { BadRequestError } from "../../errors/bad-request.error.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import { VarianteDao } from "./variante.dao.js";
import { ProductoService } from "../productos/producto.service.js";

/**
 * Reglas de negocio de variantes.
 *
 * Una variante sólo existe si su producto tiene `tiene_variantes = true`
 * e invierte el flag del producto al crearse.
 */
export class VarianteService {
  constructor({ varianteDao, productoService, token } = {}) {
    this.varianteDao = varianteDao || new VarianteDao(token);
    this.productoService = productoService || new ProductoService({ token });
  }

  async create(emprendimientoId, productoId, dto) {
    const producto = await this.productoService.getById(emprendimientoId, productoId);

    if (!producto.tiene_variantes) {
      // Se promotee el producto: agregar la primera variante activa el flag.
      await this.productoService.update(emprendimientoId, productoId, {
        tiene_variantes: true,
      });
    }

    return this.varianteDao.create({ productoId, ...dto });
  }

  async list(emprendimientoId, productoId) {
    await this.productoService.getById(emprendimientoId, productoId);
    return this.varianteDao.listByProducto(productoId);
  }

  async getById(id) {
    return this.varianteDao.findByIdOrFail(id);
  }

  async update(id, dto) {
    const variante = await this.getById(id);
    return this.varianteDao.update(variante.id, dto);
  }

  /**
   * Resuelve la variante de un item de canal (talle, color, tamaño).
   * @returns {Promise<{ variante: object|null, requiereRevision: boolean, motivo?: string }>}
   */
  async resolveFromChannel(producto, textoVariante) {
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (!textoVariante) {
      return {
        variante: null,
        requiereRevision: Boolean(producto?.tiene_variantes),
        motivo: producto?.tiene_variantes
          ? "El producto tiene variantes pero el mensaje no indica cuál"
          : undefined,
      };
    }

    // Normalizar expresiones equivalentes: "talle M" -> "m", "M" -> "m"
    const textoNorm = norm(textoVariante).replace(/^(talle|color|sabor)\s+/i, "");

    const candidatas = await this.varianteDao.listByProducto(producto.id);
    const matches = candidatas.filter((v) => {
      const vNorm = norm(v.nombre).replace(/^(talle|color|sabor)\s+/i, "");
      return vNorm === textoNorm;
    });

    if (matches.length === 1) {
      return { variante: matches[0], requiereRevision: false };
    }
    if (matches.length > 1) {
      return {
        variante: null,
        requiereRevision: true,
        motivo: `"${textoVariante}" coincide con ${matches.length} variantes`,
      };
    }

    return {
      variante: null,
      requiereRevision: true,
      motivo: `No se encontró la variante "${textoVariante}" del producto ${producto.nombre}`,
    };
  }
}

export default VarianteService;