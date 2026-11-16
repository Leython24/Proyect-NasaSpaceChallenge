import { useEffect, useRef } from "react";
import { ArrowLeftRight, FlaskConical, Mountain } from "lucide-react";
import {
  criterionLabels,
  formatScore,
  formatDeg,
  formatRatio,
} from "./similarity.js";
import { CandidateOverviewMap } from "./CandidateOverviewMap.jsx";
import { AtlasImage, PeruEvidence } from "./Evidence.jsx";
import { CELESTIAL_BODIES } from "./catalog.js";
import { ORIGIN_LABELS, prefersReducedMotion } from "./theme.js";

const criteria = [
  { id: "overall", label: "Mejores generales" },
  { id: "geological", label: "Similitud geológica" },
  { id: "topographic", label: "Similitud topográfica" },
  { id: "thermal", label: "Similitud térmica" },
  { id: "environmental", label: "Similitud ambiental" },
];

// Ensayo orientativo según la dimensión con mayor afinidad del modelo
// exploratorio. No cambia el puntaje: solo traduce la dimensión a una prueba.
const trialByDimension = {
  [criterionLabels.geological]:
    "Ensayar instrumentos de análisis mineralógico y protocolos de toma de muestras.",
  [criterionLabels.topographic]:
    "Ensayar la navegación y la movilidad de un rover en pendientes y desniveles comparables.",
  [criterionLabels.thermal]:
    "Probar equipos y procedimientos bajo un rango térmico parecido.",
  [criterionLabels.environmental]:
    "Ensayar operaciones de campo en condiciones de aridez y aislamiento comparables.",
};

function BodyDot({ body }) {
  return (
    <span
      data-body={body}
      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full bg-mint-400"
      aria-hidden="true"
    />
  );
}

/** Identifica de un vistazo los dos lugares que se comparan. */
function PairBanner({ a, b, origin, score }) {
  return (
    <div className="o-card mt-4 flex flex-wrap items-center gap-3 sm:gap-4" aria-live="polite">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <BodyDot body={a.body} />
        <div className="min-w-0">
          <div className="o-eyebrow">{CELESTIAL_BODIES[a.body]?.shortName ?? a.body}</div>
          <div className="truncate font-display text-base font-semibold text-white">{a.name}</div>
        </div>
      </div>
      <ArrowLeftRight size={18} className="flex-shrink-0 text-mint-400" aria-label="frente a" />
      <div key={b.id} className="o-swap flex min-w-0 flex-1 items-center gap-2.5">
        <BodyDot body={b.body} />
        <div className="min-w-0">
          <div className="o-eyebrow">{b.countryOrBody}</div>
          <div className="truncate font-display text-base font-semibold text-white">{b.name}</div>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        {score && <span className="o-origin">Puntaje de prueba {score}</span>}
        {origin && ORIGIN_LABELS[origin.source] && (
          <span key={origin.ts} className="o-origin o-swap" role="status">
            Seleccionado desde: {ORIGIN_LABELS[origin.source]}
          </span>
        )}
      </div>
    </div>
  );
}

export function ComparisonView({
  activeBody,
  activeBodyId,
  selectedRegion,
  activeCandidateObj,
  activeAnalog,
  rankedCandidates,
  selectedAnalogIndex,
  onSelectCandidate,
  candidateOrigin,
  isVisible = true,
  analogSortCriterion,
  setAnalogSortCriterion,
  hasPeruCandidates,
  candidateScope,
  setCandidateScope,
  candidateDisplay,
  setCandidateDisplay,
  showCandidateMap,
  setShowCandidateMap,
  sectorCatalog,
  dataState,
  handleSelectRegion,
  handleOpenTerrain,
  setViewMode,
  setIsConfigOpen,
}) {
  const rail = useRef(null);
  const peruCandidate = activeAnalog.isPeru ? activeAnalog : selectedRegion.isPeru ? selectedRegion : null;
  const score = peruCandidate ? null : formatScore(activeCandidateObj.scores.overall);
  const trial =
    trialByDimension[activeCandidateObj.primaryDimensionLabel] ??
    "Definir el ensayo con el equipo a partir de las variables que coinciden.";

  // La lista se desplaza sola (solo en horizontal) hasta la tarjeta seleccionada,
  // también cuando la selección viene del mapa o del globo.
  useEffect(() => {
    if (!isVisible) return;
    const strip = rail.current;
    const card = strip?.querySelector(`[data-index="${selectedAnalogIndex}"]`);
    if (!strip || !card) return;
    const left = card.offsetLeft - strip.clientWidth / 2 + card.offsetWidth / 2;
    strip.scrollTo({ left, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [selectedAnalogIndex, isVisible, rankedCandidates]);

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-4 sm:px-8 py-5 sm:py-6">
      <button
        onClick={() => setViewMode("explore")}
        className="inline-flex min-h-[36px] items-center gap-2 text-sm text-slatex-300 hover:text-mint-300 transition-colors"
      >
        <span aria-hidden="true">←</span>
        <span>Volver a {activeBody.shortName}</span>
      </button>

      <div className="mt-2 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="o-kicker">Comparación · {activeBody.shortName}</div>
          <h1 className="o-title mt-1">
            {activeBodyId === "luna"
              ? "Dos mundos. Una misma huella."
              : "Paisajes distintos. Pistas en común."}
          </h1>
          <p className="mt-1.5 o-body max-w-3xl">
            {peruCandidate
              ? "Compara el relieve de dos ventanas de estudio con la misma escala y revisa sus fuentes."
              : "Puntaje de prueba con valores del prototipo: geología 35 %, topografía 25 %, temperatura 20 % y ambiente 20 %."}
          </p>
        </div>

        {!peruCandidate && (
          <div
            className="flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-space-700 bg-space-850 p-1.5"
            role="group"
            aria-label="Ordenar candidatos"
          >
            {criteria.map((crit) => (
              <button
                key={crit.id}
                aria-pressed={analogSortCriterion === crit.id}
                onClick={() => {
                  setAnalogSortCriterion(crit.id);
                  onSelectCandidate(0, null);
                }}
                className={`min-h-[36px] flex-shrink-0 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors duration-180 ${
                  analogSortCriterion === crit.id
                    ? "bg-mint-400 text-space-950 font-semibold"
                    : "text-slatex-300 hover:text-white hover:bg-space-800"
                }`}
              >
                {crit.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <PairBanner a={selectedRegion} b={activeAnalog} origin={candidateOrigin} score={score} />

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="o-kicker">
            {peruCandidate
              ? `Lugares de estudio (${rankedCandidates.length})`
              : `Candidatos (${rankedCandidates.length}) · ${criterionLabels[analogSortCriterion]}`}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasPeruCandidates && (
              <select
                className="min-h-[36px] rounded-lg border border-space-700 bg-space-800 px-2 text-xs text-slate-200"
                aria-label="Alcance de candidatos"
                value={candidateScope}
                onChange={(event) => {
                  setCandidateScope(event.target.value);
                  onSelectCandidate(0, null);
                  setAnalogSortCriterion("overall");
                  if (event.target.value === "peru") setCandidateDisplay("map");
                }}
              >
                <option value="all">Catálogo mundial</option>
                <option value="peru">Sectores del Perú</option>
              </select>
            )}
            {showCandidateMap && (
              <button
                type="button"
                onClick={() =>
                  setCandidateDisplay((value) =>
                    value === "globe" ? "map" : "globe",
                  )
                }
                className="o-chip"
              >
                {candidateDisplay === "globe" ? "Mapa 2D" : "Globo 3D"}
              </button>
            )}
            <button
              onClick={() => setShowCandidateMap((v) => !v)}
              aria-pressed={showCandidateMap}
              className="o-chip"
            >
              {showCandidateMap ? "Ocultar mapa" : "Ver mapa de candidatos"}
            </button>
          </div>
        </div>

        <div ref={rail} className="orbita-candidate-rail" role="listbox" aria-label="Candidatos">
          {rankedCandidates.map((cand, idx) => {
            const isSelected = idx === selectedAnalogIndex;
            const dimScore =
              analogSortCriterion === "overall"
                ? cand.scores.overall
                : cand.scores[analogSortCriterion];
            return (
              <button
                key={cand.region.id}
                data-index={idx}
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelectCandidate(idx, "rail")}
                className={`min-h-[76px] p-3 rounded-2xl border text-left transition-[background-color,border-color,box-shadow] duration-180 ${
                  isSelected
                    ? "bg-mint-400/15 border-mint-400 shadow-[0_0_20px_rgb(var(--accent-400)/0.2)]"
                    : "bg-space-850/80 border-space-700/80 hover:border-space-600"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-mint-400">
                    {peruCandidate ? "Lugar de estudio" : `Candidato #${idx + 1}`}
                  </span>
                  {!peruCandidate && (
                    <span className="px-2 py-0.5 rounded-full bg-space-950 text-xs font-bold text-mint-300">
                      {formatScore(dimScore)}
                    </span>
                  )}
                </div>
                <div className="mt-1 font-semibold text-sm text-white truncate">
                  {cand.region.name}
                </div>
                <div className="text-xs text-slatex-400 truncate">
                  {cand.region.countryOrBody} · {cand.primaryDimensionLabel}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showCandidateMap && (
        <div className="mt-4">
          <CandidateOverviewMap
            candidates={rankedCandidates}
            selectedIndex={selectedAnalogIndex}
            onSelectCandidate={(index) => onSelectCandidate(index, "map")}
            display={candidateDisplay}
            accentBody={activeBodyId}
          />
        </div>
      )}

      <div key={activeAnalog.id} className="o-swap">
        {peruCandidate ? (
          <PeruEvidence
            candidate={peruCandidate}
            catalog={sectorCatalog}
            dataState={dataState}
            onAnalyze={() => handleOpenTerrain(peruCandidate, "sector")}
          />
        ) : (
          <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-4 p-5 rounded-3xl bg-space-900/60 border border-space-800 space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="o-kicker">Puntaje de prueba</span>
                  <span className="font-display text-2xl font-bold text-mint-300">{score}</span>
                </div>
                <p className="mt-1 o-legend">
                  Índice orientativo a partir de las variables disponibles en el
                  catálogo. Los valores de ejemplo requieren validación.
                </p>

                <div className="mt-4 space-y-2.5 text-xs">
                  {[
                    { label: "Geología y mineralogía (35 %)", val: activeCandidateObj.scores.geological },
                    { label: "Topografía y pendiente (25 %)", val: activeCandidateObj.scores.topographic },
                    { label: "Régimen térmico (20 %)", val: activeCandidateObj.scores.thermal },
                    { label: "Condiciones ambientales (20 %)", val: activeCandidateObj.scores.environmental },
                  ].map((bar) => (
                    <div key={bar.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slatex-300">{bar.label}</span>
                        <span className="font-semibold text-mint-300">{formatScore(bar.val)}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-space-950 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-mint-400 transition-[width] duration-220"
                          style={{ width: `${bar.val ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-space-800">
                <div className="o-eyebrow mb-3">Comparación de variables físicas</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    ["Pendiente media", `${formatDeg(selectedRegion.slopeMeanDeg)} / ${formatDeg(activeAnalog.slopeMeanDeg)}`, (selectedRegion.slopeMeanDeg ?? 0) / 90, (activeAnalog.slopeMeanDeg ?? 0) / 90],
                    ["Índice de aridez", `${formatRatio(selectedRegion.aridityScore)} vs ${formatRatio(activeAnalog.aridityScore)}`, Math.max(0.12, selectedRegion.aridityScore ?? 0), Math.max(0.12, activeAnalog.aridityScore ?? 0)],
                  ].map(([label, text, first, second]) => (
                    <div key={label} className="o-stat">
                      <div className="o-legend">{label}</div>
                      <div className="mt-1 font-semibold text-white">{text}</div>
                      <div className="mt-1.5 flex items-end gap-1.5 h-8" aria-hidden="true">
                        <div className="flex-1 bg-sky-400/70 rounded-t" style={{ height: `${first * 100}%` }} title={selectedRegion.name} />
                        <div className="flex-1 bg-mint-400 rounded-t" style={{ height: `${second * 100}%` }} title={activeAnalog.name} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 o-legend">
                  <span className="inline-block h-2 w-2 rounded-sm bg-sky-400/70" aria-hidden="true" /> {selectedRegion.name}
                  {"  "}
                  <span className="ml-2 inline-block h-2 w-2 rounded-sm bg-mint-400" aria-hidden="true" /> {activeAnalog.name}
                </p>
              </div>

              <div className="pt-4 border-t border-space-800 space-y-3 text-xs">
                <div className="o-stat">
                  <div className="o-eyebrow mb-1 text-sky-300">¿Qué podemos comparar?</div>
                  <p className="text-xs text-slatex-300 leading-relaxed">
                    {activeCandidateObj.summary ?? selectedRegion.comparisonSummary}
                  </p>
                </div>

                <div>
                  <div className="o-kicker mb-1.5">Lo que se parece</div>
                  <ul className="space-y-1 text-slatex-300 text-xs">
                    {activeCandidateObj.matchingVariables.length === 0 && (
                      <li className="text-slatex-400">Ninguna dimensión supera el 72 % en el modelo exploratorio.</li>
                    )}
                    {activeCandidateObj.matchingVariables.map((m, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-mint-400 font-bold" aria-hidden="true">✓</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-400 mb-1.5">Dónde difieren</div>
                  <ul className="space-y-1 text-slatex-400 text-xs">
                    {activeCandidateObj.differingVariables.map((d, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-bold" aria-hidden="true">≠</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="o-stat border-mint-400/30">
                  <div className="o-kicker mb-1 flex items-center gap-1.5">
                    <FlaskConical size={14} aria-hidden="true" /> Ensayo que tendría sentido
                  </div>
                  <p className="text-xs leading-relaxed text-slate-200">{trial}</p>
                  <p className="mt-1 o-legend">
                    Orientativo: se deriva de la dimensión más afín ({activeCandidateObj.primaryDimensionLabel}); no modifica el puntaje.
                  </p>
                </div>
              </div>
            </div>

            {[
              [
                selectedRegion,
                selectedRegion.body === "tierra"
                  ? "Ubicación terrestre seleccionada"
                  : selectedRegion.body === "luna"
                    ? "Región lunar seleccionada"
                    : "Región marciana seleccionada",
                false,
              ],
              [
                activeAnalog,
                activeAnalog.body === "tierra"
                  ? `Análogo terrestre (#${selectedAnalogIndex + 1})`
                  : activeAnalog.body === "luna"
                    ? `Análogo lunar (#${selectedAnalogIndex + 1})`
                    : `Análogo marciano (#${selectedAnalogIndex + 1})`,
                true,
              ],
            ].map(([loc, roleLabel, isHighlighted]) => (
              <div
                key={loc.id}
                className="xl:col-span-4 glass-panel rounded-3xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-bold uppercase tracking-[0.15em] ${isHighlighted ? "text-mint-400" : "text-slatex-300"}`}>
                      {roleLabel}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slatex-400">
                      <BodyDot body={loc.body} /> {loc.countryOrBody}
                    </span>
                  </div>

                  <div className="mt-3 relative rounded-2xl overflow-hidden border border-space-700/80 aspect-[16/10] bg-space-950">
                    <AtlasImage item={loc} className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-space-950/85 backdrop-blur-sm text-[11px] text-slatex-300 flex justify-between gap-2">
                      <span className="truncate">{loc.instrument}</span>
                      <span className="text-mint-300 flex-shrink-0">{loc.spatialResolution}</span>
                    </div>
                  </div>

                  <h3 className="mt-4 o-subtitle text-2xl">{loc.name}</h3>
                  <div className="text-xs text-slatex-400 mt-1">
                    {loc.countryOrBody} · {loc.coordsText}
                  </div>

                  <p className="mt-3 text-xs text-slatex-300 leading-relaxed">{loc.geologyNotes}</p>

                  <dl className="mt-4 pt-3.5 border-t border-space-700/70 space-y-2 text-xs">
                    {[
                      ["Relieve", loc.terrainType],
                      ["Elevación", loc.elevation],
                      ["Temperatura", loc.temperature],
                      ["Pendiente", loc.slope],
                    ].map(([term, value]) => (
                      <div key={term} className="flex justify-between gap-3">
                        <dt className="text-slatex-400">{term}:</dt>
                        <dd className="text-white font-medium text-right">{value}</dd>
                      </div>
                    ))}
                    <div className="pt-1">
                      <dt className="text-slatex-400">Mineralogía:</dt>
                      <dd className="text-slate-200 font-medium">{loc.mineralogy}</dd>
                    </div>
                    <div className="pt-1">
                      <dt className="text-slatex-400">Agua / Hielo:</dt>
                      <dd className="text-mint-300 font-medium">{loc.waterIce}</dd>
                    </div>
                    <div className="pt-1 o-legend">Procedencia: {loc.dataSource}</div>
                  </dl>
                </div>

                <div className="mt-4 pt-3 border-t border-space-700/70 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {loc.tags.map((tag) => (
                      <span key={tag} className={`text-xs font-medium ${isHighlighted ? "text-mint-400" : "text-slatex-400"}`}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => handleSelectRegion(loc, "compare")}
                    className={`w-full justify-between ${isHighlighted ? "o-btn-primary" : "o-btn-secondary"}`}
                  >
                    <span className="flex items-center gap-2">
                      <Mountain size={15} aria-hidden="true" /> Abrir {loc.name} en el globo 3D
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="mt-6 text-sm text-mint-300 underline underline-offset-2"
        onClick={() => setIsConfigOpen(true)}
      >
        {peruCandidate ? "Fuentes y créditos del mapa" : "Fuentes de visualización y método del índice"}
      </button>
    </div>
  );
}
