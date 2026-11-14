import {
  criterionLabels,
  formatScore,
  formatDeg,
  formatRatio,
} from "./similarity.js";
import { CandidateOverviewMap } from "./CandidateOverviewMap.jsx";
import { AtlasImage, PeruEvidence } from "./Evidence.jsx";

export function ComparisonView({
  activeBody,
  activeBodyId,
  selectedRegion,
  activeCandidateObj,
  activeAnalog,
  rankedCandidates,
  selectedAnalogIndex,
  setSelectedAnalogIndex,
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
  setViewMode,
  setIsConfigOpen,
}) {
  return (
    <div className="h-full overflow-y-auto px-5 sm:px-8 py-6">
      <button
        onClick={() => setViewMode("explore")}
        className="inline-flex items-center gap-2 text-xs text-slatex-300 hover:text-mint-300 transition-colors"
      >
        <span>←</span>
        <span>Volver a {activeBody.shortName}</span>
      </button>

      <div className="mt-3 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-4xl text-white">
            {activeBodyId === "luna"
              ? "Dos mundos. Una misma huella."
              : "Paisajes distintos. Pistas en común."}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slatex-400">
            Índice exploratorio: geología 35 %, topografía 25 %, temperatura 20
            % y ambiente 20 %. Consulta las fuentes y el alcance de cada
            comparación.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-space-850 p-1.5 rounded-xl border border-space-700">
          {[
            { id: "overall", label: "Mejores generales" },
            { id: "geological", label: "Similitud geológica" },
            { id: "topographic", label: "Similitud topográfica" },
            { id: "thermal", label: "Similitud térmica" },
            { id: "environmental", label: "Similitud ambiental" },
          ].map((crit) => (
            <button
              key={crit.id}
              onClick={() => {
                setAnalogSortCriterion(crit.id);
                setSelectedAnalogIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                analogSortCriterion === crit.id
                  ? "bg-mint-400 text-space-950 font-semibold shadow-sm"
                  : "text-slatex-300 hover:text-white hover:bg-space-800"
              }`}
            >
              {crit.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold tracking-[0.14em] text-mint-400 uppercase">
            CANDIDATOS ({rankedCandidates.length}) ·{" "}
            {criterionLabels[analogSortCriterion]}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {hasPeruCandidates && (
              <select
                className="rounded-lg bg-space-800 px-2 py-1 text-xs text-slate-200"
                aria-label="Alcance de candidatos"
                value={candidateScope}
                onChange={(event) => {
                  setCandidateScope(event.target.value);
                  setSelectedAnalogIndex(0);
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
                className="text-xs font-medium text-mint-300 underline"
              >
                {candidateDisplay === "globe" ? "Mapa 2D" : "Globo 3D"}
              </button>
            )}
            <button
              onClick={() => setShowCandidateMap((v) => !v)}
              className="text-xs font-medium text-mint-300 hover:text-mint-200 underline"
            >
              {showCandidateMap
                ? "Ocultar mapa de candidatos"
                : "Ver mapa de candidatos"}
            </button>
          </div>
        </div>

        <div className="orbita-candidate-rail">
          {rankedCandidates.map((cand, idx) => {
            const isSelected = idx === selectedAnalogIndex;
            const dimScore =
              analogSortCriterion === "overall"
                ? cand.scores.overall
                : cand.scores[analogSortCriterion];
            return (
              <button
                key={cand.region.id}
                onClick={() => setSelectedAnalogIndex(idx)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? "bg-mint-400/15 border-mint-400 shadow-[0_0_20px_rgba(94,234,212,0.18)]"
                    : "bg-space-850/80 border-space-700/80 hover:border-space-500"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-mint-400">
                    Candidato #{idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-space-950 text-xs font-bold text-mint-300">
                    {formatScore(dimScore)}
                  </span>
                </div>
                <div className="mt-1 font-semibold text-sm text-white truncate">
                  {cand.region.name}
                </div>
                <div className="text-[11px] text-slatex-400 truncate">
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
            onSelectCandidate={setSelectedAnalogIndex}
            display={candidateDisplay}
          />
        </div>
      )}

      {(activeAnalog.isPeru || selectedRegion.isPeru) && (
        <PeruEvidence
          candidate={activeAnalog.isPeru ? activeAnalog : selectedRegion}
          catalog={sectorCatalog}
          dataState={dataState}
        />
      )}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-4 flex flex-col justify-between p-5 rounded-3xl bg-space-900/60 border border-space-800 space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.15em] text-mint-400 uppercase">
                ÍNDICE EXPLORATORIO
              </span>
              <span className="text-lg font-display font-bold text-mint-300">
                {formatScore(activeCandidateObj.scores.overall)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slatex-400">
              Índice orientativo a partir de las variables disponibles en el
              catálogo. Los valores de ejemplo requieren validación.
            </p>

            <div className="mt-4 space-y-2.5 text-xs">
              {[
                {
                  label: "Geología y Mineralogía (35%)",
                  val: activeCandidateObj.scores.geological,
                },
                {
                  label: "Topografía y Pendiente (25%)",
                  val: activeCandidateObj.scores.topographic,
                },
                {
                  label: "Régimen Térmico (20%)",
                  val: activeCandidateObj.scores.thermal,
                },
                {
                  label: "Condiciones Ambientales (20%)",
                  val: activeCandidateObj.scores.environmental,
                },
              ].map((bar) => (
                <div key={bar.label}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slatex-300">{bar.label}</span>
                    <span className="font-semibold text-mint-300">
                      {formatScore(bar.val)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-space-950 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-mint-400 transition-all duration-500"
                      style={{ width: `${bar.val ?? 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-space-800">
            <div className="text-[10px] font-bold tracking-[0.14em] text-slatex-400 uppercase mb-3">
              COMPARACIÓN DE VARIABLES FÍSICAS
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-space-950/80 border border-space-800">
                <div className="text-[10px] text-slatex-400">
                  Pendiente media
                </div>
                <div className="mt-1 font-semibold text-white">
                  {formatDeg(selectedRegion.slopeMeanDeg)} /{" "}
                  {formatDeg(activeAnalog.slopeMeanDeg)}
                </div>
                <div className="mt-1.5 flex items-end gap-1.5 h-8">
                  <div
                    className="flex-1 bg-sky-400/70 rounded-t"
                    style={{
                      height: `${((selectedRegion.slopeMeanDeg ?? 0) / 90) * 100}%`,
                    }}
                    title={selectedRegion.name}
                  />
                  <div
                    className="flex-1 bg-mint-400 rounded-t"
                    style={{
                      height: `${((activeAnalog.slopeMeanDeg ?? 0) / 90) * 100}%`,
                    }}
                    title={activeAnalog.name}
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-space-950/80 border border-space-800">
                <div className="text-[10px] text-slatex-400">
                  Índice de aridez
                </div>
                <div className="mt-1 font-semibold text-white">
                  {formatRatio(selectedRegion.aridityScore)} vs{" "}
                  {formatRatio(activeAnalog.aridityScore)}
                </div>
                <div className="mt-1.5 flex items-end gap-1.5 h-8">
                  <div
                    className="flex-1 bg-sky-400/70 rounded-t"
                    style={{
                      height: `${Math.max(12, Math.round((selectedRegion.aridityScore ?? 0) * 100))}%`,
                    }}
                    title={selectedRegion.name}
                  />
                  <div
                    className="flex-1 bg-mint-400 rounded-t"
                    style={{
                      height: `${Math.max(12, Math.round((activeAnalog.aridityScore ?? 0) * 100))}%`,
                    }}
                    title={activeAnalog.name}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-space-800 space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-space-950/80 border border-space-800">
              <div className="text-[10px] font-bold tracking-[0.14em] text-sky-400 uppercase mb-1">
                ¿QUÉ PODEMOS COMPARAR?
              </div>
              <p className="text-[11px] text-slatex-300 leading-relaxed">
                {activeCandidateObj.summary ?? selectedRegion.comparisonSummary}
              </p>
            </div>

            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] text-mint-400 uppercase mb-1.5">
                VARIABLES QUE COINCIDEN
              </div>
              <ul className="space-y-1 text-slatex-300 text-[11px]">
                {activeCandidateObj.matchingVariables.map((m, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-mint-400 font-bold">✓</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] text-amber-400 uppercase mb-1.5">
                VARIABLES QUE DIFIEREN
              </div>
              <ul className="space-y-1 text-slatex-400 text-[11px]">
                {activeCandidateObj.differingVariables.map((d, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">≠</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {(() => {
          const renderComparisonCard = (loc, roleLabel, isHighlighted) => (
            <div
              key={loc.id}
              className="xl:col-span-4 glass-panel rounded-3xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold tracking-[0.15em] uppercase ${
                      isHighlighted ? "text-mint-400" : "text-slatex-300"
                    }`}
                  >
                    {roleLabel}
                  </span>
                  <span className="text-[11px] text-slatex-400">
                    {loc.countryOrBody}
                  </span>
                </div>

                <div className="mt-3 relative rounded-2xl overflow-hidden border border-space-700/80 aspect-[16/10] bg-space-950">
                  <AtlasImage
                    item={loc}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-space-950/85 backdrop-blur-sm text-[10px] text-slatex-300 flex justify-between gap-2">
                    <span className="truncate">{loc.instrument}</span>
                    <span className="text-mint-300 flex-shrink-0">
                      {loc.spatialResolution}
                    </span>
                  </div>
                </div>

                <h3 className="mt-4 font-display font-bold text-2xl text-white">
                  {loc.name}
                </h3>
                <div className="text-xs text-slatex-400 mt-1">
                  {loc.countryOrBody} · {loc.coordsText}
                </div>

                <p className="mt-3 text-xs text-slatex-300 leading-relaxed">
                  {loc.geologyNotes}
                </p>

                <div className="mt-4 pt-3.5 border-t border-space-700/70 space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-slatex-400">Relieve:</span>
                    <span className="text-white font-medium text-right">
                      {loc.terrainType}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slatex-400">Elevación:</span>
                    <span className="text-white font-medium text-right">
                      {loc.elevation}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slatex-400">Temperatura:</span>
                    <span className="text-white font-medium text-right">
                      {loc.temperature}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slatex-400">Pendiente:</span>
                    <span className="text-white font-medium text-right">
                      {loc.slope}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-slatex-400 block">Mineralogía:</span>
                    <span className="text-slate-200 font-medium">
                      {loc.mineralogy}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-slatex-400 block">Agua / Hielo:</span>
                    <span className="text-mint-300 font-medium">
                      {loc.waterIce}
                    </span>
                  </div>
                  <div className="pt-1 text-[10px] text-slatex-400">
                    Procedencia: {loc.dataSource}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-space-700/70 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {loc.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-[11px] font-medium ${
                        isHighlighted ? "text-mint-400" : "text-slatex-400"
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleSelectRegion(loc)}
                  className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                    isHighlighted
                      ? "bg-mint-400 hover:bg-mint-300 text-space-950"
                      : "bg-space-800 hover:bg-space-700 border border-space-600/80 text-white"
                  }`}
                >
                  <span>Abrir {loc.name} en modelo 3D</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          );

          return (
            <>
              {renderComparisonCard(
                selectedRegion,
                selectedRegion.body === "tierra"
                  ? "UBICACIÓN TERRESTRE SELECCIONADA"
                  : selectedRegion.body === "luna"
                    ? "REGIÓN LUNAR SELECCIONADA"
                    : "REGIÓN MARCIANA SELECCIONADA",
                false,
              )}
              {renderComparisonCard(
                activeAnalog,
                activeAnalog.body === "tierra"
                  ? `ANÁLOGO TERRESTRE (#${selectedAnalogIndex + 1})`
                  : activeAnalog.body === "luna"
                    ? `ANÁLOGO LUNAR (#${selectedAnalogIndex + 1})`
                    : `ANÁLOGO MARCIANO (#${selectedAnalogIndex + 1})`,
                true,
              )}
            </>
          );
        })()}
      </div>

      <button
        type="button"
        className="mt-6 text-xs text-mint-300 underline"
        onClick={() => setIsConfigOpen(true)}
      >
        Fuentes de visualización y método del índice
      </button>
    </div>
  );
}
