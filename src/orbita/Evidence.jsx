import { useState } from "react";
import { localSources, missions } from "../data/catalog.js";
import {
  formatDifference,
  formatMetric,
  metrics,
  relativeDifference,
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
    "Mediciones del dossier disponibles en el catálogo local.",
  published:
    "Incluye los registros publicados en Supabase y las ventanas exploratorias locales.",
  loading: "Consultando registros publicados en Supabase.",
  offline: "Supabase no está disponible. Se muestran las mediciones del catálogo local.",
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

export function PeruEvidence({ candidate, catalog, dataState, onAnalyze }) {
  const sector = candidate.sector;
  const reference = catalog.referencias.find(
    (row) => row.id === sector.referencia_id,
  );
  const mission = missions[sector.mision];
  const dataSources = [...new Set([sector.fuente_id, reference?.fuente_id,
    sector.fuente_id === "copernicus-glo90" ? "worldcover" : undefined])]
    .map((id) => catalog.fuentes.find((source) => source.id === id))
    .filter((source) => source && webLink(source.url));
  const sameScale = sector.resolucion_analisis_m > 0 &&
    sector.resolucion_analisis_m === reference?.resolucion_analisis_m;
  const rows = metrics.map((metric) => ({
    ...metric,
    a: sector[metric.key],
    b: reference?.[metric.key],
    relative: sameScale ? relativeDifference(sector[metric.key], reference?.[metric.key]) : null,
  }));
  const ranked = rows.filter((row) => row.relative !== null);
  const closest = ranked.length > 1 ? ranked.reduce((x, y) => (y.relative < x.relative ? y : x)) : null;
  const farthest = ranked.length > 1 ? ranked.reduce((x, y) => (y.relative > x.relative ? y : x)) : null;

  return (
    <section
      className="glass-panel mt-6 rounded-2xl p-4 sm:p-5"
      aria-label="Mediciones del sector peruano"
    >
      <div className="o-kicker">Ficha de la comparación</div>
      <h2 className="o-subtitle mt-1">
        {candidate.name} frente a {reference?.nombre}
      </h2>
      <p className="mt-1 text-xs text-slatex-400">{dataMessages[dataState]}</p>
      {sameScale && sector.lado_m === reference.lado_m && sector.lado_m > 0 && (
        <p className="mt-1 text-xs text-slatex-300">
          Ventanas de {sector.lado_m} × {sector.lado_m} m · malla de {sector.resolucion_analisis_m} m · pendiente suave menor a {sector.umbral_suave_deg_estricto}°.
        </p>
      )}
      <div className="mt-3 overflow-x-auto overscroll-x-contain rounded-xl border border-space-700/70">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <thead className="bg-space-900/70 text-slatex-300">
            <tr>
              {[
                "Métrica",
                candidate.name,
                reference?.nombre ?? "Referencia",
                "Diferencia",
                "Lectura",
              ].map((label) => (
                <th key={label} className="p-2.5 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label, unit, differenceUnit, a, b, relative }) => {
              const top = Math.max(Math.abs(a ?? 0), Math.abs(b ?? 0)) || 1;
              const tag = key === closest?.key ? "Se parece más" : key === farthest?.key ? "Mayor diferencia" : null;
              return (
                <tr key={key} className="border-t border-space-700 align-top">
                  <th scope="row" className="p-2.5 font-medium text-slate-200">
                    {label}
                  </th>
                  <td className="p-2.5">
                    {formatMetric(a, unit)}
                    <span className="mt-1 block h-1.5 rounded-full bg-sky-400/70" style={{ width: `${Math.max(4, (Math.abs(a ?? 0) / top) * 100)}%` }} aria-hidden="true" />
                  </td>
                  <td className="p-2.5">
                    {formatMetric(b, unit)}
                    <span className="mt-1 block h-1.5 rounded-full bg-mint-400" style={{ width: `${Math.max(4, (Math.abs(b ?? 0) / top) * 100)}%` }} aria-hidden="true" />
                  </td>
                  <td className="p-2.5">
                    {sameScale ? formatDifference(
                      a,
                      b,
                      differenceUnit ?? unit,
                    ) : "—"}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    {relative === null ? (
                      <span className="text-slatex-400">Sin escala común</span>
                    ) : (
                      <>
                        <span className={tag === "Se parece más" ? "text-mint-300 font-semibold" : tag ? "text-amber-300 font-semibold" : "text-slatex-300"}>
                          {tag ?? "Intermedia"}
                        </span>
                        <span className="block o-legend">diferencia relativa {Math.round(relative * 100)} %</span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 o-legend">
        La lectura ordena las métricas por diferencia relativa (|A − B| dividido entre el mayor valor). No es un puntaje ni sustituye la metodología del dossier.
      </p>
      {Number.isFinite(sector.cobertura_pct) && (
        <p className="mt-3 text-xs text-slatex-300">
          <strong>Cobertura de pendiente.</strong> {formatMetric(sector.cobertura_pct, " %")}
          {sector.celdas_totales ? ` · ${sector.celdas_validas_pendiente} de ${sector.celdas_totales} celdas.` : "."}
          {sector.cobertura_pct < 100 && " Los resultados describen la parte del sector con datos válidos."}
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="o-stat border-mint-400/30">
          <div className="o-kicker">Ensayo propuesto</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-200">{sector.ensayo || mission.trial}</p>
        </div>
        <div className="o-stat">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-400">Límite de la analogía</div>
          <p className="mt-1 text-xs leading-relaxed text-slatex-300">{sector.limites || mission.limit}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <span className="text-slatex-400">Fuentes:</span>
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
      <button type="button" onClick={onAnalyze} className="o-btn-primary mt-4">
        Analizar este sector en GeoPendiente
      </button>
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
