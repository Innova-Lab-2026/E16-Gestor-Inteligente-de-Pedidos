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
    return this.varianteDao.update(variante.id, toRowSafe(dto));
  }

  /**
   * Resuelve la variante de un item de canal (talle, color, tamaño).
   * @returns {Promise<{ variante: object|null, requiereRevision: boolean, motivo?: string }>}
   */
  async resolveFromChannel(producto, textoVariante) {
    if (!textoVariante) {
      return {
        variante: null,
        requiereRevision: Boolean(producto?.tiene_variantes),
        motivo: producto?.tiene_variantes
          ? "El producto tiene variantes pero el mensaje no indica cuál"
          : undefined,
      };
    }

    const candidatas = await this.varianteDao.findByNombre(
      producto.id,
      textoVariante
    );

    if (candidatas.length === 1) {
      return { variante: candidatas[0], requiereRevision: false };
    }

    if (candidatas.length > 1) {
      return {
        variante: null,
        requiereRevision: true,
        motivo: `"${textoVariante}" coincide con ${candidatas.length} variantes`,
      };
    }

    return {
      variante: null,
      requiereRevision: true,
      motivo: `No se encontró la variante "${textoVariante}" del producto ${producto.nombre}`,
    };
  }
}

const toRowSafe = (dto) => {
  const row = {};
  if (dto.nombre !== undefined) row.nombre = dto.nombre;
  if (dto.stockDisponible !== undefined) row.stock_disponible = dto.stockDisponible;
  if (dto.stockMinimo !== undefined) row.stock_minimo = dto.stockMinimo;
  if (dto.activo !== undefined) row.activo = dto.activo;
  return row;
};

export default VarianteService;