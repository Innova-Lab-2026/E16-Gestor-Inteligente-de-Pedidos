// modules/whatsapp-pedidos/order-template-validator.js
import { VarianteService } from "../variantes/variante.service.js";

const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export class OrderTemplateValidator {
  constructor({ productoService, varianteService } = {}) {
    this.productoService = productoService;
    this.varianteService = varianteService || new VarianteService();
  }

  async validate(emprendimientoId, parsed) {
    const errors = [];
    const itemsNormalizados = [];

    // Validar entrega.
    const entregaNorm = normalize(parsed.entrega);
    let modalidadEntrega = null;
    if (entregaNorm === "retiro") modalidadEntrega = "RETIRO";
    else if (entregaNorm === "envio" || entregaNorm === "envío") modalidadEntrega = "ENVIO";
    else errors.push(`Entrega inválida: "${parsed.entrega}". Usá "Retiro" o "Envío".`);

    if (modalidadEntrega === "ENVIO" && !parsed.direccion) {
      errors.push("Falta el campo Dirección para entrega por envío.");
    }

    if (!parsed.nombre || !parsed.nombre.trim()) {
      errors.push("Falta el campo Nombre.");
    }

    // Validar ítems.
    const productos = await this.productoService.list(emprendimientoId, { soloActivos: true });

    for (let i = 0; i < parsed.items.length; i++) {
      const it = parsed.items[i];
      const idx = i + 1;

      // Cantidad.
      const cantidad = Number(it.cantidadTexto);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        errors.push(`Ítem ${idx}: cantidad inválida (debe ser entero mayor a 0).`);
      }

      // Producto: coincidencia exacta normalizada o por código; si no hay,
      // se intenta coincidencia parcial (contains) para tolerar nombres
      // similares y sugerir candidatos en vez de fallar seco.
      const prodNorm = normalize(it.productoTexto);
      let candidatos = productos.filter((p) => {
        const nombreNorm = normalize(p.nombre);
        const codigoNorm = normalize(p.sku_o_identificador || p.identificador_externo || "");
        return nombreNorm === prodNorm || (codigoNorm && codigoNorm === prodNorm);
      });
      if (candidatos.length === 0) {
        candidatos = productos.filter((p) => {
          const nombreNorm = normalize(p.nombre);
          return nombreNorm.includes(prodNorm) || prodNorm.includes(nombreNorm);
        });
      }

      if (candidatos.length === 0) {
        const disponibles = productos.map((p) => p.nombre).join(", ");
        errors.push(
          `Ítem ${idx}: producto "${it.productoTexto}" no encontrado. Disponibles: ${disponibles}.`,
        );
        // No se puede validar variante sin producto.
        continue;
      }
      if (candidatos.length > 1) {
        errors.push(
          `Ítem ${idx}: el nombre "${it.productoTexto}" es ambiguo (${candidatos.length} productos).`,
        );
        continue;
      }

      const producto = candidatos[0];

      // Variante.
      let varianteId = null;
      const resolved = await this.varianteService.resolveFromChannel(
        producto,
        it.varianteTexto,
      );
      if (resolved.requiereRevision) {
        // Solo es error si el producto tiene variantes obligatorias.
        if (producto.tiene_variantes) {
          const variantes = await this.varianteService.list(
            emprendimientoId,
            producto.id,
          );
          const nombres = variantes.map((v) => v.nombre).join(", ");
          errors.push(
            `Ítem ${idx}: ${resolved.motivo}. Variantes válidas: ${nombres}.`,
          );
          continue;
        }
        // Si no tiene variantes, se permite omitir.
      } else if (resolved.variante) {
        varianteId = resolved.variante.id;
      }

      if (errors.length === 0 || true) {
        // Acumular solo si no hubo error para este ítem.
      }

      // Solo agregar si no hubo errores para este ítem.
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

export default OrderTemplateValidator;