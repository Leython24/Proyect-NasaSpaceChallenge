// Acentos por cuerpo celeste. Las mismas cifras viven como variables CSS en
// styles.css ([data-body]); aquí se usan para Leaflet y los lienzos 2D.
export const ACCENTS = {
  tierra: { strong: "#5eead4", soft: "#99f6e4", label: "Tierra" },
  marte: { strong: "#ff8f5a", soft: "#ffc2a1", label: "Marte" },
  luna: { strong: "#b3c3ff", soft: "#dde5ff", label: "Luna" },
};

export const accentOf = (body) => ACCENTS[body] ?? ACCENTS.tierra;

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Qué acción produjo la selección vigente (se muestra en la ficha). */
export const ORIGIN_LABELS = {
  globe: "Marcador del globo",
  chip: "Lista de regiones",
  search: "Búsqueda",
  compare: "Ficha de comparación",
  nearest: "Región cercana",
  probe: "Punto tocado en el globo",
  body: "Cambio de cuerpo celeste",
  map: "Mapa de candidatos",
  rail: "Lista de candidatos",
};
