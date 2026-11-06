// modules/whatsapp-pedidos/intent-detector.js
//
// Detector conservador de intención de pedido a partir de texto libre.
// No crea pedidos ni interpreta semánticamente: solo reconoce un conjunto
// acotado de expresiones. Si no hay match, no se sugiere nada.

const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const EXCLUSIONES = [
  "?",
  "tenes",
  "tenés",
  "precio",
  "cuanto",
  "cuánto",
  "catalogo",
  "catálogo",
  "stock",
  "disponible",
  "hay",
  "cancelar",
  "anular",
  "cambiar",
  "modificar",
];

const FRASES_DIRECTAS = [
  "quiero hacer un pedido",
  "quiero registrar un pedido",
  "quiero hacer un pedido por whatsapp",
  "necesito hacer un pedido",
  "quiero comprar",
  "quiero pedir",
  "quiero encargar",
];

export class IntentDetector {
  detect(texto) {
    const t = normalize(texto);
    if (!t) return false;

    // Si ya es una plantilla completada, no es intención.
    if (t.startsWith("pedido")) return false;

    // Exclusiones duras: consultas, cancelaciones, etc.
    if (EXCLUSIONES.some((w) => t.includes(normalize(w)))) return false;

    // Frases directas.
    if (FRASES_DIRECTAS.some((f) => t === f || t.startsWith(f + " "))) {
      return true;
    }

    // Intención probable: verbo de compra + cantidad + sustantivo.
    const regexProbable =
      /^(quiero|necesito|dame|me das)\s+\d+\s+\w+(\s+\w+){0,3}$/;
    if (regexProbable.test(t)) return true;

    return false;
  }
}

export default IntentDetector;