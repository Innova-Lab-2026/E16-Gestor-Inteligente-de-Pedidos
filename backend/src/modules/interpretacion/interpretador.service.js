import { INTENCION_MENSAJE } from "./intencion.enum.js";

const SALUDOS = ["hola", "buenas", "buen dia", "buenas tardes", "buenas noches", "hey", "hi"];
const CONSULTAS = ["que productos", "qué productos", "catalogo", "catálogo", "tenes", "tenés", "que tenes", "qué tenés"];
const CONSULTAS_PRECIO = ["cuanto sale", "cuánto sale", "precio", "cuanto cuesta", "cuánto cuesta", "valor"];
const MODIFICACION = ["agrega", "agregame", "sumar", "añadir", "modificar", "cambiar"];
const CANCELACION = ["cancelar", "cancela", "anular", "borrar pedido"];

const UNIDADES = ["docenas?", "unidades?", "kg", "kilos?", "litros?", "cajas?", "paquetes?"];
const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export class InterpretadorService {
  /**
   * Contrato uniforme independiente del proveedor (IA o reglas).
   * @param {{ text: string }} input
   * @returns {{ intencion, confianza, items, informacion_faltante, ambiguedades, requiere_aclaracion }}
   */
  interpretar({ text }) {
    const t = normalize(text);
    const intencion = this.clasificarIntencion(t);
    const confianza = intencion === INTENCION_MENSAJE.INDETERMINADO ? 0.4 : 0.85;

    if (intencion !== INTENCION_MENSAJE.PEDIDO) {
      return {
        intencion,
        confianza,
        items: [],
        informacion_faltante: [],
        ambiguedades: [],
        requiere_aclaracion: false,
      };
    }

    const items = this.extraerItems(text);
    const informacion_faltante = [];
    const ambiguedades = [];
    if (items.length === 0) {
      informacion_faltante.push("producto");
    }
    for (const it of items) {
      if (!it.cantidad) informacion_faltante.push(`cantidad para ${it.producto_mencionado}`);
    }

    return {
      intencion,
      confianza,
      items,
      informacion_faltante,
      ambiguedades,
      requiere_aclaracion: items.length === 0 || items.some((i) => !i.cantidad),
    };
  }

  clasificarIntencion(t) {
    if (!t) return INTENCION_MENSAJE.INDETERMINADO;

    const sinSaludo = t.replace(/^(hola|buenas|buen dia|buenas tardes|buenas noches|hey|hi)[,\s]*/i, "").trim();

    if (CANCELACION.some((w) => t.includes(w))) return INTENCION_MENSAJE.CANCELACION;
    if (MODIFICACION.some((w) => t.includes(w))) return INTENCION_MENSAJE.MODIFICACION;
    if (CONSULTAS_PRECIO.some((w) => t.includes(w))) return INTENCION_MENSAJE.CONSULTA_PRECIO;
    if (CONSULTAS.some((w) => t.includes(w))) return INTENCION_MENSAJE.CONSULTA;

    if (SALUDOS.some((w) => t === w || t.startsWith(w + " ") || t.startsWith(w + ","))) {
      if (!sinSaludo || !/\b(quiero|necesito|pedir|comprar|encargar|dame|me das|\d+\s+\w+)\b/.test(sinSaludo)) {
        return INTENCION_MENSAJE.SALUDO;
      }
    }

    if (/\b(quiero|necesito|pedir|comprar|encargar|dame|me das)\b/.test(t)) {
      return INTENCION_MENSAJE.PEDIDO;
    }
    if (/\b\d+\s+\w+/.test(t)) return INTENCION_MENSAJE.PEDIDO;

    if (SALUDOS.some((w) => t === w)) return INTENCION_MENSAJE.SALUDO;

    return INTENCION_MENSAJE.INDETERMINADO;
  }

  extraerItems(text) {
    if (!text) return [];
    return String(text)
      .split(/[\n;,]+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((linea) => {
        const conCantidad = /^(\d{1,3})\s*(?:x\b)?\s*(.+)$/i.exec(linea);
        let cantidad = null;
        if (conCantidad) {
          const n = Number(conCantidad[1]);
          if (Number.isInteger(n) && n > 0) cantidad = n;
        }
        // "una remera" -> cantidad 1 explícita
        if (cantidad === null) {
          const m = /^(una|uno|un)\s+(.+)$/i.exec(linea.trim());
          if (m) {
            cantidad = 1;
          }
        }
        let descripcion = linea.trim();
        if (cantidad !== null && conCantidad) {
          descripcion = conCantidad[2].trim();
        } else if (cantidad === 1 && /^(una|uno|un)\s+/i.test(linea.trim())) {
          descripcion = linea.trim().replace(/^(una|uno|un)\s+/i, "").trim();
        }
        let unidad = null;
        const unidadMatch = new RegExp(`\\b(${UNIDADES.join("|")})\\b`, "i").exec(descripcion);
        if (unidadMatch) unidad = unidadMatch[1];
        const conVariante = /(.+?)\s+(talle|color|sabor)\s+([\wÁÉÍÓÚáéíóúñ]+)\s*$/i.exec(descripcion);
        let variante = null;
        if (conVariante) {
          descripcion = conVariante[1].trim();
          variante = `${conVariante[2]} ${conVariante[3]}`.trim();
        }
        // quitar unidad del producto_mencionado? mantener completo para resolver
        return {
          producto_mencionado: descripcion,
          cantidad,
          unidad,
          variante_mencionada: variante,
        };
      })
      .filter((i) => i.producto_mencionado.length > 0);
  }
}

export default InterpretadorService;