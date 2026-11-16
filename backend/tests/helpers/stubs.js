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
    const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    const { esDenominacionMasEspecifica } = await import("../../src/utils/normalize.js");

    if (identificadorExterno) {
      const porId = productos.find(
        (p) => p.identificador_externo && p.identificador_externo === identificadorExterno
      );
      if (porId) return { producto: porId, requiereRevision: false, estado: "resuelto", candidatos: [porId] };
    }

    const q = norm(nombre);
    const exactos = productos.filter((p) => norm(p.nombre) === q);
    if (exactos.length === 1) {
      const hayMasEspecificos = productos.some((p) =>
        p.id !== exactos[0].id && esDenominacionMasEspecifica(exactos[0].nombre, p.nombre)
      );
      if (hayMasEspecificos) {
        return {
          producto: null,
          requiereRevision: true,
          estado: "ambiguo",
          candidatos: productos.filter((p) =>
            esDenominacionMasEspecifica(exactos[0].nombre, p.nombre) || norm(p.nombre) === q
          ),
          motivo: `Coincide con ${productos.filter((p) => esDenominacionMasEspecifica(exactos[0].nombre, p.nombre)).length} producto(s) más específico(s)`,
        };
      }
      return { producto: exactos[0], requiereRevision: false, estado: "resuelto", candidatos: exactos };
    }
    if (exactos.length > 1) {
      return { producto: null, requiereRevision: true, estado: "ambiguo", candidatos: exactos, motivo: `Coincide con ${exactos.length} productos` };
    }

    const skuExactos = productos.filter((p) => norm(p.sku_o_identificador) === q || norm(p.identificador_externo) === q);
    if (skuExactos.length === 1) return { producto: skuExactos[0], requiereRevision: false, estado: "resuelto", candidatos: skuExactos };
    if (skuExactos.length > 1) return { producto: null, requiereRevision: true, estado: "ambiguo", candidatos: skuExactos, motivo: `Coincide con ${skuExactos.length} productos` };

    if (!nombre) return { producto: null, requiereRevision: true, estado: "faltante", candidatos: [], motivo: `No se encontró el producto "${nombre}"` };

    const sugerencias = productos.filter((p) => { const n=norm(p.nombre); return n.includes(q) || q.includes(n); });
    return { producto: null, requiereRevision: true, estado: "inexistente", candidatos: sugerencias, motivo: `No se encontró el producto "${nombre}"` };
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
    const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    const { esDenominacionMasEspecifica } = await import("../../src/utils/normalize.js");

    if (!textoVariante) {
      return {
        variante: null,
        requiereRevision: Boolean(producto.tiene_variantes),
        estado: producto.tiene_variantes ? "faltante" : "no_aplica",
        candidatos: [],
        motivo: producto.tiene_variantes ? "Falta la variante" : undefined,
      };
    }
    const q = norm(textoVariante);
    const candidatas = variantes.filter(
      (v) => v.producto_id === producto.id
    );
    const matches = candidatas.filter((v) => norm(v.nombre) === q);
    if (matches.length === 1) {
      const hayMasEspecificas = candidatas.some((v) =>
        v.id !== matches[0].id && esDenominacionMasEspecifica(matches[0].nombre, v.nombre)
      );
      if (hayMasEspecificas) {
        return {
          variante: null,
          requiereRevision: true,
          estado: "ambiguo",
          candidatos: candidatas.filter((v) =>
            esDenominacionMasEspecifica(matches[0].nombre, v.nombre) || norm(v.nombre) === q
          ),
          motivo: `Coincide con ${candidatas.filter((v) => esDenominacionMasEspecifica(matches[0].nombre, v.nombre)).length} variante(s) más específica(s)`,
        };
      }
      return { variante: candidatas[0], requiereRevision: false, estado: "resuelto", candidatos: matches };
    }
    if (matches.length > 1) {
      return { variante: null, requiereRevision: true, estado: "ambiguo", candidatos: matches, motivo: `Variante "${textoVariante}" no única (${matches.length})` };
    }
    const sugerencias = candidatas.filter((v) => { const n=norm(v.nombre); return n.includes(q) || q.includes(n); });
    return {
      variante: null,
      requiereRevision: true,
      estado: "inexistente",
      candidatos: sugerencias,
      motivo: `Variante "${textoVariante}" no encontrada`,
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
