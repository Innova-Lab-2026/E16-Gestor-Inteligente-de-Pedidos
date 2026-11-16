export const normalizeText = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeKey = (s) =>
  normalizeText(s).replace(/^(talle|color|sabor)\s+/i, "");

/**
 * Indica si `nombreCandidato` es una denominación más específica que `nombreBase`,
 * es decir, si comienza con el nombre base seguido de un separador (espacio).
 * Se usa para detectar cuando un nombre exacto es genérico frente a otros
 * productos/variantes más específicos del catálogo.
 * @param {string} nombreBase
 * @param {string} nombreCandidato
 * @returns {boolean}
 */
export const esDenominacionMasEspecifica = (nombreBase, nombreCandidato) => {
  const base = normalizeText(nombreBase);
  const cand = normalizeText(nombreCandidato);
  if (!base || !cand || cand === base) return false;
  return cand.startsWith(`${base} `);
};
