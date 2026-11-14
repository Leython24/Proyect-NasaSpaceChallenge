import { useEffect, useMemo, useState } from "react";
import { buildDemo, missions } from "../data/catalog.js";
import { loadPublishedCatalog, remoteRequested } from "../data/supabase.js";
import { formatMetric } from "../data/presentation.js";
import geojson from "../data/sectores.geojson?raw";
import { PLANETARY_REGIONS } from "./catalog.js";
import { formatCoords } from "./geography.js";

const baseline = buildDemo(JSON.parse(geojson));
export const referenceRegions = { "JEZ-01": "jezero", "SHA-01": "shackleton" };
const setting = {
  marte: {
    terrainType: "Entorno desértico costero",
    reliefShort: "Desierto costero",
    summary:
      "Examinar pendientes y transiciones de relieve en una ventana del desierto de Sechura.",
  },
  luna: {
    terrainType: "Entorno volcánico andino",
    reliefShort: "Campo volcánico",
    summary:
      "Examinar perfiles de pendiente y movilidad en una ventana del valle volcánico de Andagua.",
  },
};

function mapPolygon(sector) {
  const mission = missions[sector.mision];
  const details = setting[sector.mision];
  const geometry = sector.geometria;
  const ring = (
    geometry?.type === "MultiPolygon"
      ? geometry.coordinates?.[0]?.[0]
      : geometry?.coordinates?.[0]
  )?.slice(0, -1);
  const [lat, lon] = ring?.length
    ? [1, 0].map(
        (axis) =>
          ring.reduce((total, vertex) => total + vertex[axis], 0) / ring.length,
      )
    : mission.center;
  return {
    id: sector.id,
    isPeru: true,
    sector,
    body: "tierra",
    lat,
    lon,
    coordsText: formatCoords(lat, lon),
    name: `${sector.id} · ${mission.region}`,
    countryOrBody: `Perú · ${sector.departamento}`,
    elevation: "Elevación absoluta sin publicar",
    temperature: "Sin datos comparables",
    terrainType: details.terrainType,
    reliefShort: details.reliefShort,
    mineralogy: "Pendiente de caracterización",
    materialShort: "Pendiente de caracterización",
    tags: [mission.region, sector.id, "Perú"],
    slope: formatMetric(sector.pendiente_mediana_deg, "°"),
    slopeMeanDeg: null,
    waterIce: "Sin datos comparables",
    geologyNotes: details.summary,
    comparisonSummary: sector.similitud || details.summary,
    comparisonHeadline: "Hipótesis de campo",
    comparisonSubtext: sector.limites || mission.limit,
    analogCategory: "SECTOR CANDIDATO · PERÚ",
    dataSource: "Catálogo de GeoAnálogos Perú",
    instrument: "Modelo de elevación",
    spatialResolution: Number.isFinite(sector.resolucion_analisis_m)
      ? `${sector.resolucion_analisis_m} m/píxel`
      : "Pendiente",
    imageDate: "Ventana de estudio",
    analogIds: [referenceRegions[sector.referencia_id]],
  };
}

function mergePublished(published) {
  return Object.fromEntries(
    Object.keys(baseline).map((key) => [
      key,
      [
        ...new Map(
          [...baseline[key], ...published[key]].map((record) => [
            record.id,
            record,
          ]),
        ).values(),
      ],
    ]),
  );
}

export function useAtlasCatalog() {
  const [sectorCatalog, setSectorCatalog] = useState(baseline);
  const [dataState, setDataState] = useState(
    remoteRequested ? "loading" : "local",
  );
  useEffect(() => {
    if (!remoteRequested) return;
    let active = true;
    loadPublishedCatalog()
      .then((published) => {
        if (!active) return;
        setSectorCatalog(mergePublished(published));
        setDataState("published");
      })
      .catch(() => {
        if (active) setDataState("offline");
      });
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    const references = sectorCatalog.referencias;
    const backgroundRegions = PLANETARY_REGIONS.map((region) => ({
      ...region,
      reference: references.find(
        (reference) => referenceRegions[reference.id] === region.id,
      ),
    }));
    return {
      regions: [
        ...backgroundRegions,
        ...sectorCatalog.sectores.map(mapPolygon),
      ],
      sectorCatalog,
      dataState,
    };
  }, [sectorCatalog, dataState]);
}
