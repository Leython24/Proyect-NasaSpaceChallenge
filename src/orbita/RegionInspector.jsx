import { CELESTIAL_BODIES } from "./catalog.js";
import { formatScore } from "./similarity.js";
import { AtlasImage, DataEvidence } from "./Evidence.jsx";
import { RegionTerrain } from "./RegionTerrain.jsx";
import { ORIGIN_LABELS } from "./theme.js";

export function RegionInspector({
  viewMode,
  focusedSystemBody,
  focusedSystemBodyId,
  setFocusedSystemBodyId,
  regions,
  selectedRegion,
  selectionOrigin,
  activeBodyId,
  activeBody,
  activeCandidateObj,
  rankedCandidates,
  handleNavigateBody,
  handleOpenComparison,
  onComparePeru,
  handleOpenTerrain,
  handleSelectRegion,
}) {
  return (
    <aside className="w-full lg:w-[375px] lg:absolute lg:top-6 lg:right-6 lg:bottom-6 z-20 p-4 lg:p-0 flex-shrink-0 pointer-events-none">
      <div className="glass-panel rounded-3xl p-5 sm:p-6 h-full flex flex-col justify-between overflow-y-auto overscroll-contain pointer-events-auto">
        {viewMode === "system" ? (
          <div key={focusedSystemBodyId} className="o-swap flex min-h-full flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="o-kicker">Cuerpo en foco</span>
                <span className="text-[11px] text-slatex-400">
                  Globo interactivo
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-space-950/80 border border-space-800">
                {["luna", "marte", "tierra"].map((bId) => (
                  <button
                    key={bId}
                    onClick={() => setFocusedSystemBodyId(bId)}
                    data-body={bId}
                    aria-pressed={focusedSystemBodyId === bId}
                    className={`min-h-[36px] rounded-lg text-xs font-semibold transition-colors duration-180 ${
                      focusedSystemBodyId === bId
                        ? "bg-mint-400/20 text-mint-300 border border-mint-400/30"
                        : "text-slatex-400 hover:text-white"
                    }`}
                  >
                    {CELESTIAL_BODIES[bId].shortName}
                  </button>
                ))}
              </div>

              <h2 className="o-title mt-4 text-2xl sm:text-3xl">
                {focusedSystemBody.name}
              </h2>
              <p className="mt-1.5 text-xs text-slatex-400 leading-relaxed">
                {focusedSystemBody.tagline}
              </p>

              <div className="mt-4 relative rounded-2xl overflow-hidden border border-space-700/80 aspect-[16/10] bg-space-950">
                <AtlasImage
                  item={focusedSystemBody}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-space-950/70 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 left-3 text-[11px] font-medium text-slate-200">
                  {focusedSystemBody.subtitle}
                </div>
              </div>

              <h3 className="mt-5 font-display font-semibold text-base text-white">
                {focusedSystemBody.focusPrompt}
              </h3>
              <p className="mt-1.5 text-xs text-slatex-400 leading-relaxed">
                {focusedSystemBody.focusDesc}
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-space-700/80">
              {(() => {
                const suggested = regions.find(
                  (r) => r.id === focusedSystemBody.defaultRegionId,
                );
                return suggested ? (
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold tracking-[0.14em] text-slatex-400 uppercase">
                      REGIÓN SUGERIDA
                    </div>
                    <div className="mt-1 font-semibold text-sm text-white">
                      {suggested.name}
                    </div>
                    <div className="text-xs text-slatex-400">
                      {suggested.tags.join(" · ")}
                    </div>
                  </div>
                ) : null;
              })()}

              <button
                onClick={() => handleNavigateBody(focusedSystemBody.id)}
                className="o-btn-primary w-full justify-between"
              >
                <span>{focusedSystemBody.ctaText}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        ) : (
          selectedRegion && (
            <div key={selectedRegion.id} className="o-swap flex min-h-full flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="o-kicker truncate">
                    {selectedRegion.isCustomProbe
                      ? `COORDENADA ORBITAL / ${activeBody.shortName.toUpperCase()}`
                      : `REGIÓN DESTACADA / ${activeBody.shortName.toUpperCase()}`}
                  </span>
                  <span className="text-[11px] text-slatex-400 flex-shrink-0">
                    {selectedRegion.coordsText}
                  </span>
                </div>
                {selectionOrigin && ORIGIN_LABELS[selectionOrigin.source] && (
                  <span className="o-origin mt-2" role="status">
                    <span aria-hidden="true">●</span> Seleccionada desde:{" "}
                    {ORIGIN_LABELS[selectionOrigin.source]}
                  </span>
                )}

                <h2 className="o-title mt-2 text-2xl sm:text-[1.7rem]">
                  {selectedRegion.name}
                </h2>
                <div className="text-xs text-slatex-400 mt-0.5">
                  {selectedRegion.countryOrBody}
                </div>

                <div className="mt-3.5 relative rounded-2xl overflow-hidden border border-space-700/80 aspect-[16/9] bg-space-950">
                  <AtlasImage
                    item={selectedRegion}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1 rounded-lg bg-space-950/80 backdrop-blur-sm text-[11px] text-slatex-300 truncate">
                    {selectedRegion.dataSource}
                  </div>
                </div>

                <RegionTerrain region={selectedRegion} />
                <div className="mt-4 space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl glass-card-subtle">
                    <div className="text-[11px] uppercase tracking-wider text-slatex-400">
                      Tipo de terreno y relieve
                    </div>
                    <div className="mt-0.5 font-medium text-white">
                      {selectedRegion.terrainType}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl glass-card-subtle">
                      <div className="text-[11px] uppercase tracking-wider text-slatex-400">
                        Elevación
                      </div>
                      <div className="mt-0.5 font-medium text-white">
                        {selectedRegion.elevation}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl glass-card-subtle">
                      <div className="text-[11px] uppercase tracking-wider text-slatex-400">
                        Temperatura
                      </div>
                      <div className="mt-0.5 font-medium text-white">
                        {selectedRegion.temperature}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl glass-card-subtle">
                      <div className="text-[11px] uppercase tracking-wider text-slatex-400">
                        Pendiente
                      </div>
                      <div className="mt-0.5 font-medium text-white">
                        {selectedRegion.slope}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl glass-card-subtle">
                      <div className="text-[11px] uppercase tracking-wider text-slatex-400">
                        Agua / Hielo
                      </div>
                      <div className="mt-0.5 font-medium text-mint-300">
                        {selectedRegion.waterIce}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl glass-card-subtle">
                    <div className="text-[11px] uppercase tracking-wider text-slatex-400">
                      Composición mineralógica
                    </div>
                    <div className="mt-0.5 font-medium text-slate-200">
                      {selectedRegion.mineralogy}
                    </div>
                  </div>

                  <p className="text-[11px] text-slatex-400 leading-relaxed pt-1">
                    {selectedRegion.geologyNotes}
                  </p>
                  <DataEvidence region={selectedRegion} />
                </div>
              </div>

              {selectedRegion.nearest && (
                <button
                  type="button"
                  className="mt-3 text-xs text-mint-300 underline"
                  onClick={() => handleSelectRegion(selectedRegion.nearest, "nearest")}
                >
                  Ver región cercana: {selectedRegion.nearest.name}
                </button>
              )}
              <div className="mt-4 pt-3 border-t border-space-700/80">
                {selectedRegion.body === "tierra" && (
                  <button
                    type="button"
                    className="o-btn-ghost mb-3 w-full"
                    onClick={() =>
                      handleOpenTerrain(
                        selectedRegion,
                        selectedRegion.isPeru ? "sector" : "coordinate",
                      )
                    }
                  >
                    Analizar este terreno en GeoPendiente
                  </button>
                )}
                {onComparePeru && (
                  <button
                    type="button"
                    onClick={onComparePeru}
                    className="o-btn-primary mb-3 w-full"
                  >
                    Ver sectores en Perú
                  </button>
                )}
                {rankedCandidates.length > 0 && (
                  <>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-[0.14em] text-slatex-400 uppercase">
                    {activeBodyId === "tierra"
                      ? `TOP CANDIDATOS LUNA / MARTE (${rankedCandidates.length})`
                      : `TOP CANDIDATOS TERRESTRES (${rankedCandidates.length})`}
                  </span>
                  {activeCandidateObj && (
                    <span className="text-[11px] font-bold text-mint-400">
                      Puntaje de prueba {formatScore(activeCandidateObj.scores.overall)}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {rankedCandidates.slice(0, 4).map((cand, idx) => (
                    <button
                      key={cand.region.id}
                      onClick={() => handleOpenComparison(idx)}
                      className="o-chip text-white"
                    >
                      <span className="text-[11px] font-bold text-mint-400">
                        #{idx + 1}
                      </span>
                      <span>{cand.region.name}</span>
                      <span className="text-[11px] text-slatex-400">
                        ({formatScore(cand.scores.overall)})
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleOpenComparison()}
                  className="o-btn-primary mt-3 w-full justify-between"
                >
                  <span>
                    {activeBodyId === "tierra"
                      ? `Comparar con ${rankedCandidates.length} candidatos`
                      : `Comparar con ${rankedCandidates.length} análogos`}
                  </span>
                  <span>→</span>
                </button>

                  </>
                )}
                <div className="mt-2 text-[11px] text-slatex-500 text-center truncate">
                  {selectedRegion.instrument || "NASA PDS"} ·{" "}
                  {selectedRegion.spatialResolution || "Orbital"}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </aside>
  );
}
