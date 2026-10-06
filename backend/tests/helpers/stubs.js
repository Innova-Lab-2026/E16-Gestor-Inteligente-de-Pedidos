/**
 * Dobles de DAO en memoria.
 *
 * Permiten probar la lógica de negocio (servicios) sin tocar Supabase.
 */

/** ProductoService stub. */
export const buildProductoServiceStub = (productos = []) => ({
  async getById(emprendimientoId, id) {
    const found = productos.find((p) => p.id === id);
    if (!found) {
      const { NotFoundError } = await import(
        "../../src/errors/not-found.error.js"
      );
      throw new NotFoundError(`Producto ${id} no encontrado`);
    }
    return found;
  },

  async resolveFromChannel(emprendimientoId, { identificadorExterno, nombre }) {
    const porId = productos.find(
      (p) => p.identificador_externo && p.identificador_externo === identificadorExterno
    );
    if (porId) return { producto: porId, requiereRevision: false };

    const porNombre = productos.filter((p) => {
      const nombreProducto = p.nombre.toLowerCase();
      const texto = String(nombre ?? "").toLowerCase();
      return nombreProducto.includes(texto) || texto.includes(nombreProducto);
    });

    if (porNombre.length === 1) {
      return { producto: porNombre[0], requiereRevision: false };
    }
    if (porNombre.length > 1) {
      return {
        producto: null,
        requiereRevision: true,
        motivo: `Coincide con ${porNombre.length} productos`,
      };
    }
    return {
      producto: null,
      requiereRevision: true,
      motivo: `No se encontró el producto "${nombre}"`,
    };
  },
});

/** VarianteService stub. */
export const buildVarianteServiceStub = (variantes = []) => ({
  async getById(id) {
    const found = variantes.find((v) => v.id === id);
    if (!found) {
      const { NotFoundError } = await import("../../src/errors/not-found.error.js");
      throw new NotFoundError(`Variante ${id} no encontrada`);
    }
    return found;
  },

  async resolveFromChannel(producto, textoVariante) {
    if (!textoVariante) {
      return {
        variante: null,
        requiereRevision: Boolean(producto.tiene_variantes),
        motivo: producto.tiene_variantes ? "Falta la variante" : undefined,
      };
    }
    const candidatas = variantes.filter(
      (v) =>
        v.producto_id === producto.id &&
        v.nombre.toLowerCase().includes(textoVariante.toLowerCase())
    );
    if (candidatas.length === 1) {
      return { variante: candidatas[0], requiereRevision: false };
    }
    return {
      variante: null,
      requiereRevision: true,
      motivo: `Variante "${textoVariante}" no única (${candidatas.length})`,
    };
  },
});

/** ClienteService stub. */
export const buildClienteServiceStub = ({ porTelefono = null } = {}) => ({
  async getById(emprendimientoId, id) {
    if (id === "cliente-inexistente") return null;
    return { id, emprendimientoId, nombre: "Cliente Test" };
  },

  async findOrCreateFromChannel(emprendimientoId, datos) {
    if (porTelefono && datos.telefono === porTelefono.telefono) {
      return porTelefono;
    }
    if (!datos.nombre) {
      const { BadRequestError } = await import(
        "../../src/errors/bad-request.error.js"
      );
      throw new BadRequestError("No se puede identificar al cliente");
    }
    return { id: "cliente-nuevo", emprendimientoId, ...datos };
  },
});
