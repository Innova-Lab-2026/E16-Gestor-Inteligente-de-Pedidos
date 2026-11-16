// modules/whatsapp-pedidos/order-template-validator.js
import { normalizeText } from "../../utils/normalize.js";

export class OrderTemplateValidator {
  constructor({ productoService, varianteService } = {}) {
    this.productoService = productoService;
    this.varianteService = varianteService;
  }

  async validate(emprendimientoId, parsed) {
    const errors = [];
    const itemsNormalizados = [];

    const entregaNorm = normalizeText(parsed.entrega);
    let modalidadEntrega = null;
    if (entregaNorm === "retiro") modalidadEntrega = "RETIRO";
    else if (entregaNorm === "envio") modalidadEntrega = "ENVIO";
    else errors.push(`Entrega inválida: "${parsed.entrega}". Usá "Retiro" o "Envío".`);

    if (modalidadEntrega === "ENVIO" && !parsed.direccion) {
      errors.push("Falta el campo Dirección para entrega por envío.");
    }

    if (!parsed.nombre || !parsed.nombre.trim()) {
      errors.push("Falta el campo de su nombre de cliente.");
    }

    if (!parsed.items || parsed.items.length === 0) {
      errors.push("El pedido no contiene productos.");
    }

    for (let i = 0; i < (parsed.items || []).length; i++) {
      const it = parsed.items[i];
      const idx = i + 1;

      const cantidad = Number(it.cantidadTexto);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        errors.push(`Ítem ${idx}: cantidad inválida (debe ser entero mayor a 0).`);
      }

      const resProd = await this.productoService.resolveFromChannel(emprendimientoId, {
        nombre: it.productoTexto,
      });

      if (resProd.estado === "faltante") {
        errors.push(`Ítem ${idx}: falta el nombre del producto.`);
        continue;
      }
      if (resProd.estado === "inexistente") {
        const disponibles = (resProd.candidatos || []).map((p) => p.nombre).join(", ");
        errors.push(`Ítem ${idx}: producto "${it.productoTexto}" no encontrado.${disponibles ? " Disponibles: " + disponibles : ""}`);
        continue;
      }
      if (resProd.estado === "ambiguo") {
        const nombres = resProd.candidatos.map((p) => p.nombre).join(", ");
        errors.push(`Ítem ${idx}: el nombre "${it.productoTexto}" es ambiguo (${resProd.candidatos.length} productos): ${nombres}.`);
        continue;
      }

      const producto = resProd.producto;

      const resolved = await this.varianteService.resolveFromChannel(producto, it.varianteTexto);
      let varianteId = null;
      if (resolved.estado === "faltante") {
        if (producto.tiene_variantes) {
          const variantes = await this.varianteService.list(emprendimientoId, producto.id);
          const nombres = variantes.map((v) => v.nombre).join(", ");
          errors.push(`Ítem ${idx}: falta la variante. Variantes válidas: ${nombres}.`);
          continue;
        }
      } else if (resolved.estado === "inexistente") {
        const variantes = await this.varianteService.list(emprendimientoId, producto.id);
        const nombres = variantes.map((v) => v.nombre).join(", ");
        errors.push(`Ítem ${idx}: ${resolved.motivo}. Variantes válidas: ${nombres}.`);
        continue;
      } else if (resolved.estado === "ambiguo") {
        const nombres = resolved.candidatos.map((v) => v.nombre).join(", ");
        errors.push(`Ítem ${idx}: variante ambigua (${resolved.candidatos.length}): ${nombres}.`);
        continue;
      } else if (resolved.estado === "resuelto") {
        varianteId = resolved.variante.id;
      }

      const itemErrors = errors.filter((e) => e.startsWith(`Ítem ${idx}:`));
      if (itemErrors.length === 0) {
        itemsNormalizados.push({
          productoId: producto.id,
          varianteId,
          cantidad,
          productoNombre: producto.nombre,
        });
      }
    }

    if (errors.length > 0) {
      return { valido: false, errores: errors, dataNormalizada: null };
    }

    return {
      valido: true,
      errores: [],
      dataNormalizada: {
        items: itemsNormalizados.map((it) => ({
          producto_id: it.productoId,
          variante_id: it.varianteId,
          cantidad: it.cantidad,
        })),
        modalidadEntrega,
        direccion: parsed.direccion,
        nombre: parsed.nombre,
        telefono: parsed.telefono,
        observaciones: parsed.observaciones,
      },
    };
  }
}
