import { NotFoundError } from "../../errors/not-found.error.js";
import { BadRequestError } from "../../errors/bad-request.error.js";
import { ProductoDao } from "./producto.dao.js";
import { VarianteDao } from "../variantes/variante.dao.js";

/**
 * Reglas de negocio del catálogo.
 *
 * El stock de un producto sin variantes vive en el propio producto;
 * con variantes, en cada variante. El producto nunca se descuenta
 * cuando tiene variantes.
 */
export class ProductoService {
  constructor({ productoDao, varianteDao, token } = {}) {
    this.productoDao = productoDao || new ProductoDao(token);
    this.varianteDao = varianteDao || new VarianteDao(token);
  }

  async create(emprendimientoId, dto) {
    if (dto.tieneVariantes && dto.stockDisponible !== undefined) {
      throw new BadRequestError(
        "Un producto con variantes administra su stock por variante"
      );
    }
    return this.productoDao.create({ emprendimientoId, ...dto });
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
    return this.productoDao.update(emprendimientoId, id, cambios);
  }

  /**
   * Resolución de producto para un pedido de canal.
   * Nunca es obligatoria la coincidencia por identificador externo:
   * si no hay match, el pedido queda marcado para revisión.
   * @returns {Promise<{ producto: object|null, requiereRevision: boolean, motivo?: string }>}
   */
  async resolveFromChannel(emprendimientoId, { identificadorExterno, nombre }) {
    if (identificadorExterno) {
      const exacto = await this.productoDao.findByIdentificadorExterno(
        emprendimientoId,
        identificadorExterno
      );
      if (exacto) return { producto: exacto, requiereRevision: false };
    }

    if (nombre) {
      const candidatos = await this.productoDao.searchByName(
        emprendimientoId,
        nombre
      );
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