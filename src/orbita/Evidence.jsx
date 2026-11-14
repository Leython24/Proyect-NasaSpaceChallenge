import { useState } from "react";
import { localSources, missions } from "../data/catalog.js";
import {
  formatDifference,
  formatMetric,
  metrics,
  webLink,
} from "../data/presentation.js";
import { layers } from "./Globe.jsx";

const sources = [
  {
    name: "NASA Solar System Treks",
    detail: "Mosaicos Viking y LRO WAC. Altimetría MOLA y LOLA en color.",
    url: "https://trek.nasa.gov/",
  },
  {
    name: "NASA Earthdata · GIBS",
    detail: "Blue Marble, relieve sombreado y VIIRS Suomi NPP.",
    url: "https://www.earthdata.nasa.gov/data/projects/gibs",
  },
  {
    name: "Open-Meteo",
    detail:
      "Elevación del DEM de Copernicus y temperatura del aire a 2 m para coordenadas terrestres.",
    url: "https://open-meteo.com/en/docs",
  },
  ...localSources.map((source) => ({
    name: source.producto,
    detail: source.uso,
    url: source.url,
  })),
];

const dataMessages = {
  local:
    "Catálogo local con ventanas exploratorias. Las métricas se incorporan cuando el equipo las publica.",
  published:
    "Incluye los registros publicados en Supabase y las ventanas exploratorias locales.",
  loading: "Consultando registros publicados en Supabase.",
  offline: "Supabase no está disponible. Se muestran las ventanas locales.",
};
const media = { jezero: "jezero", shackleton: "shackleton", gale: "site-gale" };

export function AtlasImage({ item, className }) {
  const key = item.body ?? item.id;
  const asset = item.isPeru
    ? "peru"
    : item.previewImage
      ? null
      : item.isCustomProbe
        ? null
        : (media[item.id] ?? `site-${item.id}`);
  const fallback = item.body
    ? `/assets/${layers[item.body].optical[0]}.webp`
    : item.previewImage;
  const [broken, setBroken] = useState(null);
  const desired = asset ? `/assets/${asset}.webp` : item.previewImage;
  const resolved = desired && broken !== desired ? desired : fallback;
  const label = media[item.id]
    ? `Imagen de referencia de ${item.name}`
    : item.isPeru
      ? "Vista regional del Perú"
      : `Vista global o regional de ${key}`;
  return (
    <img
      className={className}
      src={resolved}
      alt={label}
      loading="lazy"
      onError={() => setBroken(desired)}
    />
  );
}

export function DataEvidence({ region }) {
  if (region.isCustomProbe || region.isPeru) return null;
  return (
    <p className="rounded-xl border border-space-700 p-2.5 text-[11px] leading-relaxed text-slatex-300">
      Ficha de contexto del prototipo. Verifica el producto, la resolución y el
      área de estudio antes de usar estas cifras como mediciones.
    </p>
  );
}

export function PeruEvidence({ candidate, catalog, dataState }) {
  const sector = candidate.sector;
  const reference = catalog.referencias.find(
    (row) => row.id === sector.referencia_id,
  );
  const mission = missions[sector.mision];
  const dataSources = [sector.fuente_id, reference?.fuente_id]
    .map((id) => catalog.fuentes.find((source) => source.id === id))
    .filter((source) => source && webLink(source.url));

  return (
    <section
      className="glass-panel mt-6 rounded-2xl p-4 sm:p-5"
      aria-label="Mediciones del sector peruano"
    >
      <h2 className="font-display text-lg font-bold text-white">
        {candidate.name} frente a {reference?.nombre}
      </h2>
      <p className="mt-1 text-xs text-slatex-400">{dataMessages[dataState]}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[31rem] text-left text-xs">
          <thead className="text-slatex-300">
            <tr>
              {[
                "Métrica",
                candidate.name,
                reference?.nombre ?? "Referencia",
                "Diferencia",
              ].map((label) => (
                <th key={label} className="p-2">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(({ key, label, unit, differenceUnit }) => (
              <tr key={key} className="border-t border-space-700">
                <th scope="row" className="p-2 font-medium">
                  {label}
                </th>
                <td className="p-2">{formatMetric(sector[key], unit)}</td>
                <td className="p-2">{formatMetric(reference?.[key], unit)}</td>
                <td className="p-2">
                  {formatDifference(
                    sector[key],
                    reference?.[key],
                    differenceUnit ?? unit,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slatex-300">
        <strong>Ensayo propuesto.</strong> {sector.ensayo || mission.trial}
      </p>
      <p className="mt-2 text-xs text-slatex-300">
        <strong>Límite de la analogía.</strong>{" "}
        {sector.limites || mission.limit}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {dataSources.map((source) => (
          <a
            key={source.id}
            className="text-mint-300 underline"
            href={webLink(source.url)}
            target="_blank"
            rel="noreferrer"
          >
            {source.producto}
          </a>
        ))}
      </div>
    </section>
  );
}

export function SourceDirectory({ dataState }) {
  return (
    <div className="mt-4 space-y-2.5 text-xs">
      {sources.map(({ name, detail, url }) => (
        <article
          key={name}
          className="rounded-xl border border-space-700 bg-space-900/80 p-3"
        >
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-mint-300 underline"
          >
            {name}
          </a>
          <p className="mt-1 text-slatex-300">{detail}</p>
        </article>
      ))}
      <p className="text-slatex-300">{dataMessages[dataState]}</p>
    </div>
  );
}
