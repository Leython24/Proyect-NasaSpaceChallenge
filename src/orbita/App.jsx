import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mountain } from "lucide-react";
import { CELESTIAL_BODIES } from "./catalog.js";
import { computeAnalogCandidates } from "./similarity.js";
import { fetchEarthContext, makeProbe, searchable } from "./geography.js";
import { useAtlasCatalog } from "./peruCatalog.js";
import {
  PlanetaryExploreGlobe,
  PlanetaryThreeViewport,
} from "./PlanetViews.jsx";
import { SourceDirectory } from "./Evidence.jsx";
import { TopBar } from "./TopBar.jsx";
import { SearchDialog } from "./SearchDialog.jsx";
import { RegionInspector } from "./RegionInspector.jsx";
import { ComparisonView } from "./ComparisonView.jsx";
import { missions } from "../data/catalog.js";

const TerrainWorkspace = lazy(() => import("./TerrainWorkspace.jsx"));

export default function App() {
  const [viewMode, setViewMode] = useState("system"); // 'system' | 'explore' | 'compare'
  const [activeBodyId, setActiveBodyId] = useState("luna"); // 'luna' | 'marte' | 'tierra'
  const [focusedSystemBodyId, setFocusedSystemBodyId] = useState("luna");
  const [selectedRegionId, setSelectedRegionId] = useState(
    CELESTIAL_BODIES.luna.defaultRegionId,
  );
  const [customProbeRegion, setCustomProbeRegion] = useState(null);
  const [selectedAnalogIndex, setSelectedAnalogIndex] = useState(0);
  const [analogSortCriterion, setAnalogSortCriterion] = useState("overall");
  const [showCandidateMap, setShowCandidateMap] = useState(true);
  const { regions, sectorCatalog, dataState } = useAtlasCatalog();
  const [candidateScope, setCandidateScope] = useState("all");
  const [candidateDisplay, setCandidateDisplay] = useState("globe");
  const [terrainTarget, setTerrainTarget] = useState(null);
  const telemetryRequest = useRef(null);

  useEffect(() => () => telemetryRequest.current?.abort(), []);

  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [zoomTrigger, setZoomTrigger] = useState(null);
  const [resetTrigger, setResetTrigger] = useState(null);

  useEffect(() => {
    const close = (event) => {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
        setIsConfigOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const activeBody = CELESTIAL_BODIES[activeBodyId];
  const focusedSystemBody = CELESTIAL_BODIES[focusedSystemBodyId];

  const regionsForActiveBody = useMemo(
    () => regions.filter((r) => r.body === activeBodyId),
    [activeBodyId, regions],
  );

  const selectedRegion = useMemo(() => {
    if (customProbeRegion && customProbeRegion.body === activeBodyId) {
      return customProbeRegion;
    }
    return (
      regionsForActiveBody.find((region) => region.id === selectedRegionId) ??
      regionsForActiveBody[0]
    );
  }, [customProbeRegion, activeBodyId, selectedRegionId, regionsForActiveBody]);

  const hasPeruCandidates =
    activeBodyId !== "tierra" &&
    regions.some(
      (region) =>
        region.isPeru && region.analogIds.includes(selectedRegion?.id),
    );
  const rankedCandidates = useMemo(
    () =>
      computeAnalogCandidates(
        selectedRegion,
        regions,
        analogSortCriterion,
        hasPeruCandidates && viewMode === "compare" ? candidateScope : "all",
      ),
    [
      selectedRegion,
      analogSortCriterion,
      regions,
      hasPeruCandidates,
      candidateScope,
      viewMode,
    ],
  );

  const activeCandidateObj =
    rankedCandidates[selectedAnalogIndex] || rankedCandidates[0];
  const activeAnalog = activeCandidateObj?.region;

  const filteredSearchRegions = useMemo(() => {
    const q = searchable(searchQuery.trim());
    if (!q) return regions;
    return regions.filter(
      (r) =>
        searchable(r.name).includes(q) ||
        searchable(r.countryOrBody).includes(q) ||
        searchable(r.coordsText).includes(q) ||
        searchable(r.terrainType).includes(q) ||
        searchable(r.mineralogy).includes(q) ||
        r.tags.some((t) => searchable(t).includes(q)),
    );
  }, [searchQuery, regions]);

  const handleNavigateSystem = () => {
    setViewMode("system");
    setMobileMenuOpen(false);
  };

  const handleNavigateBody = (bodyId) => {
    telemetryRequest.current?.abort();
    setActiveBodyId(bodyId);
    setFocusedSystemBodyId(bodyId);
    setCustomProbeRegion(null);
    const bodyMeta = CELESTIAL_BODIES[bodyId];
    if (bodyMeta && bodyMeta.defaultRegionId) {
      setSelectedRegionId(bodyMeta.defaultRegionId);
    }
    setSelectedAnalogIndex(0);
    setViewMode("explore");
    setMobileMenuOpen(false);
  };

  const handleSelectRegion = (region) => {
    telemetryRequest.current?.abort();
    setActiveBodyId(region.body);
    setFocusedSystemBodyId(region.body);
    setCustomProbeRegion(null);
    setSelectedRegionId(region.id);
    setSelectedAnalogIndex(0);
    setViewMode("explore");
    setIsSearchOpen(false);
    setMobileMenuOpen(false);
  };

  const handleSurfaceProbe = useCallback(
    (bodyId, lat, lon) => {
      telemetryRequest.current?.abort();
      const request = new AbortController();
      telemetryRequest.current = request;
      const probe = makeProbe(bodyId, lat, lon, regions);
      setCustomProbeRegion(probe);
      setSelectedAnalogIndex(0);

      if (bodyId === "tierra") {
        fetchEarthContext(lat, lon, request.signal).then((context) => {
          if (request.signal.aborted) return;
          setCustomProbeRegion((previous) =>
            previous?.id === probe.id ? { ...previous, ...context } : previous,
          );
        });
      }
    },
    [regions],
  );

  const handleOpenComparison = (index = 0) => {
    if (rankedCandidates.length === 0) return;
    setCandidateScope("all");
    setSelectedAnalogIndex(index);
    setViewMode("compare");
  };

  const handleComparePeru = () => {
    const candidates = computeAnalogCandidates(selectedRegion, regions, "overall", "peru");
    const defaultId = missions[activeBodyId]?.defaultSector;
    setCandidateScope("peru");
    setCandidateDisplay("map");
    setShowCandidateMap(true);
    setAnalogSortCriterion("overall");
    setSelectedAnalogIndex(Math.max(0, candidates.findIndex(({ region }) => region.id === defaultId)));
    setViewMode("compare");
  };

  const handleOpenTerrain = (region) => {
    const sector = region?.sector;
    const missionKey = sector?.mision ?? (activeBodyId === "luna" ? "luna" : "marte");
    const defaultId = missionKey === "luna" ? "AN-05" : "SE-05";
    setTerrainTarget({
      missionKey,
      sector: sector ?? (!region ? sectorCatalog.sectores.find(({ id }) => id === defaultId) : undefined),
      coordinates: region?.body === "tierra" ? { lat: region.lat, lon: region.lon } : undefined,
    });
    setMobileMenuOpen(false);
  };

  if (terrainTarget) {
    return (
      <Suspense fallback={<p className="p-6" role="status">Abriendo GeoPendiente…</p>}>
        <TerrainWorkspace
          target={terrainTarget}
          references={sectorCatalog.referencias}
          onClose={() => setTerrainTarget(null)}
        />
      </Suspense>
    );
  }

  const currentStep =
    viewMode === "system" ? 1 : viewMode === "explore" ? 2 : 3;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-space-950 text-slate-100">
      {/* ===============================================================
          BARRA LATERAL IZQUIERDA (FIXED SIDEBAR - MATCHING REFERENCE UI)
         =============================================================== */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[230px] flex-shrink-0 flex flex-col justify-between bg-space-850 border-r border-space-700/80 transition-transform duration-300 ${
          mobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-5">
          <button
            onClick={handleNavigateSystem}
            className="flex items-center gap-3 text-left group focus:outline-none"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-mint-400 text-space-950 shadow-[0_0_20px_rgba(94,234,212,0.35)] group-hover:scale-105 transition-transform">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
              >
                <circle cx="12" cy="12" r="8" />
                <polygon
                  points="15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 15.5 8.5"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div>
              <div className="font-display font-bold text-lg tracking-wide text-white leading-none">
                ÓRBITA
              </div>
              <div className="text-[9px] font-semibold tracking-[0.16em] text-slatex-400 mt-1">
                ANÁLOGOS PLANETARIOS
              </div>
            </div>
          </button>

          <div className="mt-8 mb-3 px-2 text-[10px] font-semibold tracking-[0.15em] text-slatex-400 uppercase">
            EXPLORACIÓN
          </div>

          <nav className="space-y-1.5">
            {[
              {
                id: "system",
                label: "Explorador",
                active: viewMode === "system",
                onClick: handleNavigateSystem,
                icon: (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <polygon points="15 9 13 13 9 15 11 11 15 9" />
                  </svg>
                ),
              },
              {
                id: "luna",
                label: "Luna",
                active: viewMode !== "system" && activeBodyId === "luna",
                onClick: () => handleNavigateBody("luna"),
                icon: (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ),
              },
              {
                id: "marte",
                label: "Marte",
                active: viewMode !== "system" && activeBodyId === "marte",
                onClick: () => handleNavigateBody("marte"),
                icon: (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="10" cy="14" r="6" />
                    <path d="M14.5 9.5L20 4" />
                    <path d="M15 4h5v5" />
                  </svg>
                ),
              },
              {
                id: "tierra",
                label: "Tierra",
                active: viewMode !== "system" && activeBodyId === "tierra",
                onClick: () => handleNavigateBody("tierra"),
                icon: (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3.6 9h16.8M3.6 15h16.8" />
                    <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" />
                  </svg>
                ),
              },
              {
                id: "geopendiente",
                label: "Conoce tu terreno",
                active: false,
                onClick: () => handleOpenTerrain(),
                icon: <Mountain size={16} aria-hidden="true" />,
              },
            ].map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  item.active
                    ? "bg-mint-400/12 text-mint-300 border border-mint-400/20"
                    : "text-slatex-400 hover:text-white hover:bg-space-800/80 border border-transparent"
                }`}
              >
                {item.active && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-mint-400" />
                )}
                <span
                  className={item.active ? "text-mint-400" : "text-slatex-400"}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-8 pt-6 border-t border-space-700/80 px-2">
            <h3 className="font-display font-semibold text-base text-white leading-snug">
              Un planeta.
              <br />
              Nuevas perspectivas.
            </h3>
            <p className="mt-2.5 text-xs text-slatex-400 leading-relaxed">
              Conecta paisajes de otros mundos con la Tierra.
            </p>
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={() => setIsConfigOpen(true)}
            className="w-full text-left p-3.5 rounded-2xl bg-space-800/90 hover:bg-space-750 border border-space-700/80 hover:border-mint-400/40 transition-all"
          >
            <div className="flex items-center justify-between gap-2 text-mint-400 text-xs font-semibold">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-mint-400 animate-pulse flex-shrink-0" />
                <span className="text-white">Motor 3D y fuentes</span>
              </span>
              <span className="text-[10px] text-mint-300 underline">APIs</span>
            </div>
            <p className="mt-1 text-[11px] text-slatex-400">
              LRO · MRO · GIBS · DEM
            </p>
          </button>
          <div className="mt-3 px-1 text-[10px] tracking-[0.14em] text-slatex-500 uppercase">
            ÓRBITA / EXPLORADOR NASA 01
          </div>
        </div>
      </aside>

      {/* ===============================================================
          CONTENIDO PRINCIPAL (TOPBAR + WORKSPACE + BOTTOM STEPPER)
         =============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar
          viewMode={viewMode}
          activeBody={activeBody}
          activeBodyId={activeBodyId}
          handleNavigateSystem={handleNavigateSystem}
          handleNavigateBody={handleNavigateBody}
          setMobileMenuOpen={setMobileMenuOpen}
          setIsSearchOpen={setIsSearchOpen}
          setIsConfigOpen={setIsConfigOpen}
        />

        <main className="relative flex-1 min-h-0 overflow-hidden bg-space-950">
          {viewMode !== "compare" ? (
            <div className="relative w-full h-full flex flex-col lg:block overflow-y-auto lg:overflow-hidden">
              <div className="orbita-stage relative w-full lg:h-full flex-shrink-0">
                {viewMode === "explore" ? (
                  <PlanetaryExploreGlobe
                    key={activeBodyId}
                    bodyId={activeBodyId}
                    regions={regionsForActiveBody}
                    selectedRegion={selectedRegion}
                    onSelectRegion={handleSelectRegion}
                    onSurfaceProbe={handleSurfaceProbe}
                    zoomTrigger={zoomTrigger}
                    resetTrigger={resetTrigger}
                  />
                ) : (
                  <PlanetaryThreeViewport
                    focusedSystemBodyId={focusedSystemBodyId}
                    onSelectSystemBody={handleNavigateBody}
                    onFocusSystemBody={setFocusedSystemBodyId}
                    zoomTrigger={zoomTrigger}
                    resetTrigger={resetTrigger}
                  />
                )}

                <div className="pointer-events-none absolute top-5 left-5 sm:top-7 sm:left-8 max-w-md z-10 orbita-hero">
                  {viewMode === "system" ? (
                    <>
                      <div className="text-[10px] font-bold tracking-[0.16em] text-mint-400 uppercase">
                        ATLAS DE ANÁLOGOS / SISTEMA SOLAR
                      </div>
                      <h1 className="mt-1.5 font-display font-bold text-2xl sm:text-4xl text-white leading-tight">
                        Otros mundos.
                        <br />
                        Paisajes que conectan.
                      </h1>
                      <p className="mt-2 text-xs sm:text-sm text-slatex-400">
                        Elige un cuerpo celeste y descubre su conexión con la
                        Tierra.
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleNavigateSystem}
                        className="pointer-events-auto inline-flex items-center gap-1.5 text-xs text-slatex-300 hover:text-mint-300 transition-colors mb-2"
                      >
                        <span>←</span>
                        <span>Sistema planetario</span>
                      </button>
                      <h1 className="font-display font-bold text-2xl sm:text-4xl text-white leading-tight">
                        {activeBody.heroTitle}
                      </h1>
                      <p className="mt-1.5 text-xs sm:text-sm text-slatex-400">
                        {activeBody.heroSubtitle}
                      </p>
                    </>
                  )}

                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="pointer-events-auto mt-4 flex items-center gap-2.5 w-full max-w-[300px] px-4 py-2.5 rounded-xl bg-space-800/85 hover:bg-space-750 backdrop-blur-md border border-space-600/60 hover:border-mint-400/50 text-xs text-slatex-400 transition-all shadow-lg"
                  >
                    <svg
                      className="w-4 h-4 text-slatex-400 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span>Buscar lugar o coordenadas</span>
                  </button>

                  {viewMode === "explore" && activeBodyId === "tierra" && (
                    <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleNavigateBody("luna")}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-space-800/90 hover:bg-space-700 border border-space-600/80 text-xs font-medium text-white transition-all"
                      >
                        <span>Explorar Luna</span>
                        <span className="text-mint-400">→</span>
                      </button>
                      <button
                        onClick={() => handleNavigateBody("marte")}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-space-800/90 hover:bg-space-700 border border-space-600/80 text-xs font-medium text-white transition-all"
                      >
                        <span>Explorar Marte</span>
                        <span className="text-mint-400">→</span>
                      </button>
                    </div>
                  )}

                  {viewMode === "explore" && (
                    <div className="pointer-events-auto mt-3 flex flex-wrap gap-1.5 max-w-md">
                      {regionsForActiveBody
                        .filter(
                          (reg) =>
                            !reg.isPeru ||
                            [selectedRegion?.id, "SE-05", "AN-05"].includes(
                              reg.id,
                            ),
                        )
                        .map((reg) => {
                          const active =
                            selectedRegion && selectedRegion.id === reg.id;
                          return (
                            <button
                              key={reg.id}
                              onClick={() => handleSelectRegion(reg)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                                active
                                  ? "bg-mint-400/20 border-mint-400/50 text-mint-300"
                                  : "bg-space-900/75 border-space-700 text-slatex-400 hover:text-white"
                              }`}
                            >
                              {reg.name}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                <div className="orbita-camera-controls absolute bottom-4 left-5 sm:bottom-6 sm:left-8 z-10 flex flex-col gap-2">
                  <div className="inline-flex items-center rounded-xl bg-space-850/90 backdrop-blur-md border border-space-700/90 p-1 shadow-xl">
                    <button
                      onClick={() =>
                        setZoomTrigger({ dir: "in", ts: Date.now() })
                      }
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slatex-300 hover:text-white hover:bg-space-700 transition-colors font-semibold"
                      title="Acercar"
                    >
                      +
                    </button>
                    <button
                      onClick={() =>
                        setZoomTrigger({ dir: "out", ts: Date.now() })
                      }
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slatex-300 hover:text-white hover:bg-space-700 transition-colors font-semibold"
                      title="Alejar"
                    >
                      −
                    </button>
                    <button
                      onClick={() => setResetTrigger(Date.now())}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-space-750 text-mint-400 hover:bg-mint-400/20 transition-colors"
                      title="Centrar vista global"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="2" x2="12" y2="5" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="5" y2="12" />
                        <line x1="19" y1="12" x2="22" y2="12" />
                      </svg>
                    </button>
                  </div>
                  {viewMode === "system" && (
                    <div className="text-[10px] tracking-wider text-slatex-500 uppercase">
                      VISTA ESPACIAL / Escala visual no real
                    </div>
                  )}
                </div>
              </div>

              <RegionInspector
                viewMode={viewMode}
                focusedSystemBody={focusedSystemBody}
                focusedSystemBodyId={focusedSystemBodyId}
                setFocusedSystemBodyId={setFocusedSystemBodyId}
                regions={regions}
                selectedRegion={selectedRegion}
                activeBodyId={activeBodyId}
                activeBody={activeBody}
                activeCandidateObj={activeCandidateObj}
                rankedCandidates={rankedCandidates}
                handleNavigateBody={handleNavigateBody}
                handleOpenComparison={handleOpenComparison}
                onComparePeru={hasPeruCandidates ? handleComparePeru : undefined}
                handleOpenTerrain={handleOpenTerrain}
                handleSelectRegion={handleSelectRegion}
              />
            </div>
          ) : (
            selectedRegion &&
            activeCandidateObj &&
            activeAnalog && (
              <ComparisonView
                activeBody={activeBody}
                activeBodyId={activeBodyId}
                selectedRegion={selectedRegion}
                activeCandidateObj={activeCandidateObj}
                activeAnalog={activeAnalog}
                rankedCandidates={rankedCandidates}
                selectedAnalogIndex={selectedAnalogIndex}
                setSelectedAnalogIndex={setSelectedAnalogIndex}
                analogSortCriterion={analogSortCriterion}
                setAnalogSortCriterion={setAnalogSortCriterion}
                hasPeruCandidates={hasPeruCandidates}
                candidateScope={candidateScope}
                setCandidateScope={setCandidateScope}
                candidateDisplay={candidateDisplay}
                setCandidateDisplay={setCandidateDisplay}
                showCandidateMap={showCandidateMap}
                setShowCandidateMap={setShowCandidateMap}
                sectorCatalog={sectorCatalog}
                dataState={dataState}
                handleSelectRegion={handleSelectRegion}
                handleOpenTerrain={handleOpenTerrain}
                setViewMode={setViewMode}
                setIsConfigOpen={setIsConfigOpen}
              />
            )
          )}
        </main>

        <footer className="h-11 flex-shrink-0 bg-space-950/95 border-t border-space-800 px-4 sm:px-8 grid grid-cols-3 gap-4 items-center z-20">
          {[
            {
              step: 1,
              label: "01 ELIGE UN MUNDO",
              onClick: handleNavigateSystem,
            },
            {
              step: 2,
              label: "02 EXPLORA UNA REGIÓN",
              onClick: () => setViewMode("explore"),
            },
            {
              step: 3,
              label:
                activeBodyId === "tierra"
                  ? "03 COMPARA CON LUNA / MARTE"
                  : "03 COMPARA CON LA TIERRA",
              onClick: () => handleOpenComparison(),
            },
          ].map((s) => {
            const isActive = currentStep === s.step;
            return (
              <button
                key={s.step}
                onClick={s.onClick}
                disabled={s.step === 3 && rankedCandidates.length === 0}
                className={`relative h-full flex items-center text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase transition-colors truncate ${
                  isActive
                    ? "text-mint-400"
                    : "text-slatex-500 hover:text-slatex-300"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-0 right-1/3 h-[2px] bg-mint-400 shadow-[0_0_8px_#5eead4]" />
                )}
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </footer>
      </div>

      {/* ===============================================================
          MODAL DE BÚSQUEDA DE REGIONES Y COORDENADAS
         =============================================================== */}
      {isSearchOpen && (
        <SearchDialog
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredSearchRegions={filteredSearchRegions}
          setIsSearchOpen={setIsSearchOpen}
          handleSelectRegion={handleSelectRegion}
          setActiveBodyId={setActiveBodyId}
          setFocusedSystemBodyId={setFocusedSystemBodyId}
          setViewMode={setViewMode}
          handleSurfaceProbe={handleSurfaceProbe}
        />
      )}

      {/* ===============================================================
          MODAL DE CONFIGURACIÓN DE APIs Y FUENTES CIENTÍFICAS
         =============================================================== */}
      {isConfigOpen && (
        <div
          onClick={() => setIsConfigOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Fuentes de datos"
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-space-800 border border-space-600/80 shadow-2xl p-6 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-xl text-white">
                  Fuentes de Datos 3D y APIs Científicas
                </h2>
                <p className="mt-1 text-xs text-slatex-400">
                  Procedencia de las capas orbitales, la telemetría y las
                  mediciones.
                </p>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="w-8 h-8 rounded-xl bg-space-700/80 hover:bg-space-600 text-slatex-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <SourceDirectory dataState={dataState} />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsConfigOpen(false)}
                className="px-4 py-2 rounded-xl bg-mint-400 text-space-950 font-semibold text-xs hover:bg-mint-300 transition-colors"
              >
                Continuar explorando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
