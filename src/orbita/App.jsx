import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Compass, Earth, Mountain, Orbit } from "lucide-react";
import { CELESTIAL_BODIES } from "./catalog.js";
import { computeAnalogCandidates } from "./similarity.js";
import { fetchEarthContext, makeProbe, searchable } from "./geography.js";
import { useAtlasCatalog } from "./peruCatalog.js";
import {
  PlanetaryExploreGlobe,
  PlanetaryThreeViewport,
} from "./PlanetViews.jsx";
import { preloadBody } from "./Globe.jsx";
import { SourceDirectory } from "./Evidence.jsx";
import { TopBar } from "./TopBar.jsx";
import { SearchDialog } from "./SearchDialog.jsx";
import { RegionInspector } from "./RegionInspector.jsx";
import { missions } from "../data/catalog.js";

const loadTerrain = () => import("./TerrainWorkspace.jsx");
const loadComparison = () => import("./ComparisonView.jsx");

/**
 * Carga diferida sin <Suspense>: React retiene ~300 ms la revelación de un
 * límite suspendido aunque el módulo ya esté descargado. Aquí el componente se
 * guarda al llegar y se dibuja directamente.
 */
function useDeferredModule(load, pick) {
  const [Component, setComponent] = useState(null);
  const request = useCallback(() => {
    load()
      .then((module) => setComponent(() => pick(module)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [Component, request];
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function MarsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="10" cy="14" r="6" />
      <path d="M14.5 9.5L20 4" />
      <path d="M15 4h5v5" />
    </svg>
  );
}

function PanelFallback({ label }) {
  return (
    <div className="flex h-full items-center justify-center gap-3 text-sm text-slatex-300" role="status">
      <span className="o-spinner" aria-hidden="true" /> {label}
    </div>
  );
}

export default function App() {
  const [viewMode, setViewMode] = useState("system"); // 'system' | 'explore' | 'compare' | 'terrain'
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
  const [returnView, setReturnView] = useState("explore");
  const [selectionOrigin, setSelectionOrigin] = useState(null);
  const [candidateOrigin, setCandidateOrigin] = useState(null);
  const [visited, setVisited] = useState({ explore: false, compare: false });
  const telemetryRequest = useRef(null);
  const [ComparisonView, requestComparison] = useDeferredModule(
    loadComparison,
    (module) => module.ComparisonView,
  );
  const [TerrainWorkspace, requestTerrain] = useDeferredModule(
    loadTerrain,
    (module) => module.default,
  );
  const panels = {
    stage: useRef(null),
    compare: useRef(null),
    terrain: useRef(null),
  };

  useEffect(() => () => telemetryRequest.current?.abort(), []);

  // Con el navegador libre se descargan por adelantado los bloques de la
  // comparación y del terreno: el primer cambio de vista no espera a la red.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 2500));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const handle = idle(
      () => {
        requestComparison();
        requestTerrain();
      },
      { timeout: 6000 },
    );
    return () => cancel(handle);
  }, [requestComparison, requestTerrain]);
  useEffect(() => {
    if (viewMode === "compare") requestComparison();
    if (viewMode === "terrain") requestTerrain();
  }, [viewMode, requestComparison, requestTerrain]);

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

  // Los paneles visitados permanecen montados (ocultos) para no rehacer globos,
  // mapas ni el iframe de GeoPendiente al volver.
  useEffect(() => {
    if (viewMode === "explore" || viewMode === "compare")
      setVisited((previous) =>
        previous[viewMode] ? previous : { ...previous, [viewMode]: true },
      );
  }, [viewMode]);

  // Conserva el foco del teclado: si el elemento enfocado quedó en un panel
  // oculto, el foco pasa al panel que acaba de aparecer.
  useEffect(() => {
    const key =
      viewMode === "compare" ? "compare" : viewMode === "terrain" ? "terrain" : "stage";
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || active.closest("[hidden]"))
        panels[key].current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const activeBody = CELESTIAL_BODIES[activeBodyId];
  const focusedSystemBody = CELESTIAL_BODIES[focusedSystemBodyId];
  const accentBody =
    viewMode === "system"
      ? focusedSystemBodyId
      : viewMode === "terrain"
        ? (terrainTarget?.missionKey ?? activeBodyId)
        : activeBodyId;

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

  // Al llegar a otro cuerpo, o desde la búsqueda o la comparación, la vista
  // vuelve arriba para que el globo y la ficha nuevos queden a la vista.
  const revealStage = () =>
    requestAnimationFrame(() => panels.stage.current?.scrollTo({ top: 0 }));

  const handleNavigateBody = (bodyId) => {
    telemetryRequest.current?.abort();
    revealStage();
    setActiveBodyId(bodyId);
    setFocusedSystemBodyId(bodyId);
    setCustomProbeRegion(null);
    const bodyMeta = CELESTIAL_BODIES[bodyId];
    if (bodyMeta && bodyMeta.defaultRegionId) {
      setSelectedRegionId(bodyMeta.defaultRegionId);
    }
    setSelectionOrigin({ source: "body", ts: Date.now() });
    setSelectedAnalogIndex(0);
    setViewMode("explore");
    setMobileMenuOpen(false);
  };

  const handleSelectRegion = (region, source = "chip") => {
    telemetryRequest.current?.abort();
    if (!["chip", "globe"].includes(source)) revealStage();
    setActiveBodyId(region.body);
    setFocusedSystemBodyId(region.body);
    setCustomProbeRegion(null);
    setSelectedRegionId(region.id);
    setSelectionOrigin({ source, ts: Date.now() });
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
      setSelectionOrigin({ source: "probe", ts: Date.now() });
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

  const handleSelectCandidate = useCallback((index, source = "rail") => {
    setSelectedAnalogIndex(index);
    setCandidateOrigin({ source, ts: Date.now() });
  }, []);

  const handleOpenComparison = (index = 0) => {
    if (rankedCandidates.length === 0) return;
    setCandidateScope("all");
    setSelectedAnalogIndex(index);
    setCandidateOrigin(null);
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
    setCandidateOrigin(null);
    setViewMode("compare");
  };

  /**
   * Abre «Conoce tu terreno» dentro del marco de Órbita. Sin región conserva
   * el último lugar abierto; con región lo sustituye. `source` identifica el
   * acceso: menú, coordenada terrestre o ficha de un sector.
   */
  const handleOpenTerrain = (region, source = region ? "coordinate" : "menu") => {
    if (viewMode !== "terrain") setReturnView(viewMode);
    setMobileMenuOpen(false);
    if (!region && terrainTarget) {
      setViewMode("terrain");
      return;
    }
    const sector = region?.sector;
    const missionKey =
      sector?.mision ?? (activeBodyId === "luna" ? "luna" : "marte");
    const defaultId = missionKey === "luna" ? "AN-05" : "SE-05";
    const resolvedSector =
      sector ??
      (!region
        ? sectorCatalog.sectores.find(({ id }) => id === defaultId)
        : undefined);
    setTerrainTarget({
      missionKey,
      sector: resolvedSector,
      coordinates:
        region?.body === "tierra" ? { lat: region.lat, lon: region.lon } : undefined,
      name: resolvedSector?.nombre ?? region?.name ?? "Lugar de estudio",
      place: resolvedSector
        ? `Perú · ${resolvedSector.departamento ?? missions[resolvedSector.mision]?.department ?? "sector del dossier"}`
        : region?.isCustomProbe
          ? "Coordenada elegida en la Tierra"
          : (region?.countryOrBody ?? "Tierra"),
      code: resolvedSector?.id ?? region?.coordsText,
      entry: source,
      openedAt: Date.now(),
    });
    setViewMode("terrain");
  };

  const handleTerrainMission = (missionKey) =>
    setTerrainTarget((previous) =>
      previous ? { ...previous, missionKey } : previous,
    );

  const currentStep =
    viewMode === "system"
      ? 1
      : viewMode === "explore"
        ? 2
        : viewMode === "compare"
          ? 3
          : 4;
  const stageVisible = viewMode === "system" || viewMode === "explore";
  const compareReady = selectedRegion && activeCandidateObj && activeAnalog;

  const navItems = [
    {
      id: "system",
      label: "Explorador",
      active: viewMode === "system",
      onClick: handleNavigateSystem,
      icon: <Compass size={16} aria-hidden="true" />,
    },
    {
      id: "luna",
      label: "Luna",
      active:
        (viewMode === "explore" || viewMode === "compare") &&
        activeBodyId === "luna",
      onClick: () => handleNavigateBody("luna"),
      intent: () => preloadBody("luna"),
      icon: <MoonIcon />,
    },
    {
      id: "marte",
      label: "Marte",
      active:
        (viewMode === "explore" || viewMode === "compare") &&
        activeBodyId === "marte",
      onClick: () => handleNavigateBody("marte"),
      intent: () => preloadBody("marte"),
      icon: <MarsIcon />,
    },
    {
      id: "tierra",
      label: "Tierra",
      active:
        (viewMode === "explore" || viewMode === "compare") &&
        activeBodyId === "tierra",
      onClick: () => handleNavigateBody("tierra"),
      intent: () => preloadBody("tierra"),
      icon: <Earth size={16} aria-hidden="true" />,
    },
    {
      id: "geopendiente",
      label: "Conoce tu terreno",
      active: viewMode === "terrain",
      onClick: () => handleOpenTerrain(),
      intent: requestTerrain,
      icon: <Mountain size={16} aria-hidden="true" />,
    },
  ];

  return (
    <div
      data-body={accentBody}
      className="flex h-dvh w-full overflow-hidden bg-space-950 text-slate-100"
    >
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[236px] flex-shrink-0 flex flex-col justify-between bg-space-850 border-r border-space-700/80 transition-transform duration-220 ${
          mobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
        aria-label="Navegación principal"
      >
        <div className="p-5">
          <button
            onClick={handleNavigateSystem}
            className="flex items-center gap-3 text-left group focus:outline-none"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-mint-400 text-space-950 shadow-[0_0_24px_rgb(var(--accent-400)/0.4)] group-hover:scale-105 transition-[transform,background-color] duration-220">
              <Orbit size={20} strokeWidth={2.3} aria-hidden="true" />
            </div>
            <div>
              <div className="font-display font-bold text-xl tracking-wide text-white leading-none">
                ÓRBITA
              </div>
              <div className="text-[11px] font-semibold tracking-[0.14em] text-slatex-400 mt-1">
                ANÁLOGOS PLANETARIOS
              </div>
            </div>
          </button>

          <div className="o-eyebrow mt-8 mb-3 px-2">Exploración</div>

          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                onPointerEnter={item.intent}
                onFocus={item.intent}
                aria-current={item.active ? "page" : undefined}
                data-body={["luna", "marte", "tierra"].includes(item.id) ? item.id : undefined}
                className={`relative w-full flex items-center gap-3 min-h-[44px] px-3.5 rounded-xl text-sm font-medium transition-[background-color,color,border-color] duration-180 ${
                  item.active
                    ? "bg-mint-400/12 text-mint-300 border border-mint-400/25"
                    : "text-slatex-400 hover:text-white hover:bg-space-800/80 border border-transparent"
                }`}
              >
                {item.active && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-mint-400" />
                )}
                <span className={item.active ? "text-mint-400" : "text-slatex-400"}>
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
            className="w-full text-left p-3.5 rounded-2xl bg-space-800/90 hover:bg-space-750 border border-space-700/80 hover:border-mint-400/40 transition-colors duration-180"
          >
            <div className="flex items-center justify-between gap-2 text-mint-400 text-xs font-semibold">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-mint-400 animate-pulse flex-shrink-0" />
                <span className="text-white">Motor 3D y fuentes</span>
              </span>
              <span className="text-[11px] text-mint-300 underline">APIs</span>
            </div>
            <p className="mt-1 text-[11px] text-slatex-400">
              LRO · MRO · GIBS · DEM
            </p>
          </button>
          <div className="mt-3 px-1 text-[11px] tracking-[0.12em] text-slatex-500 uppercase">
            ÓRBITA / EXPLORADOR NASA 01
          </div>
        </div>
      </aside>

      {/* ===============================================================
          CONTENIDO PRINCIPAL (TOPBAR + PANELES + PASOS)
         =============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar
          viewMode={viewMode}
          activeBody={activeBody}
          activeBodyId={activeBodyId}
          terrainTarget={terrainTarget}
          handleNavigateSystem={handleNavigateSystem}
          handleNavigateBody={handleNavigateBody}
          setMobileMenuOpen={setMobileMenuOpen}
          setIsSearchOpen={setIsSearchOpen}
          setIsConfigOpen={setIsConfigOpen}
        />

        <main className="relative flex-1 min-h-0 overflow-hidden bg-space-950">
          {/* ---------- Sistema y exploración ---------- */}
          <section
            ref={panels.stage}
            tabIndex={-1}
            hidden={!stageVisible}
            aria-label={viewMode === "system" ? "Sistema planetario" : `Exploración de ${activeBody.shortName}`}
            className="o-panel absolute inset-0 flex flex-col lg:block overflow-y-auto lg:overflow-hidden focus:outline-none"
          >
            <div className="orbita-stage relative w-full lg:h-full flex-shrink-0" data-mode={viewMode}>
              {viewMode === "system" && (
              <div className="absolute inset-0">
                <PlanetaryThreeViewport
                  focusedSystemBodyId={focusedSystemBodyId}
                  onSelectSystemBody={handleNavigateBody}
                  onFocusSystemBody={setFocusedSystemBodyId}
                  zoomTrigger={viewMode === "system" ? zoomTrigger : null}
                  resetTrigger={viewMode === "system" ? resetTrigger : null}
                />
              </div>
              )}
              {(visited.explore || viewMode === "explore") && (
                <div className="absolute inset-0" hidden={viewMode !== "explore"}>
                  <PlanetaryExploreGlobe
                    bodyId={activeBodyId}
                    regions={regionsForActiveBody}
                    selectedRegion={selectedRegion}
                    onSelectRegion={handleSelectRegion}
                    onSurfaceProbe={handleSurfaceProbe}
                    zoomTrigger={viewMode === "explore" ? zoomTrigger : null}
                    resetTrigger={viewMode === "explore" ? resetTrigger : null}
                    candidateCount={rankedCandidates.length}
                    onOpenComparison={handleOpenComparison}
                  />
                </div>
              )}

              <div
                key={viewMode === "system" ? "system" : `explore-${activeBodyId}`}
                className="o-swap pointer-events-none absolute top-5 left-5 sm:top-7 sm:left-8 max-w-md z-10 orbita-hero"
              >
                {viewMode === "system" ? (
                  <>
                    <div className="o-kicker">Atlas de análogos / Sistema solar</div>
                    <h1 className="o-title mt-1.5">
                      Otros mundos.
                      <br />
                      Paisajes que conectan.
                    </h1>
                    <p className="mt-2 text-sm text-slatex-300">
                      Elige un cuerpo celeste y descubre su conexión con la
                      Tierra.
                    </p>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleNavigateSystem}
                      className="pointer-events-auto inline-flex min-h-[32px] items-center gap-1.5 text-xs text-slatex-300 hover:text-mint-300 transition-colors mb-1"
                    >
                      <span aria-hidden="true">←</span>
                      <span>Sistema planetario</span>
                    </button>
                    <div className="o-kicker">{activeBody.shortName}</div>
                    <h1 className="o-title mt-1">{activeBody.heroTitle}</h1>
                    <p className="mt-1.5 text-sm text-slatex-300">
                      {activeBody.heroSubtitle}
                    </p>
                  </>
                )}

                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="pointer-events-auto mt-4 flex items-center gap-2.5 w-full max-w-[300px] min-h-[44px] px-4 rounded-xl bg-space-800/85 hover:bg-space-750 backdrop-blur-md border border-space-600/60 hover:border-mint-400/50 text-sm text-slatex-300 transition-colors duration-180 shadow-lg"
                >
                  <svg className="w-4 h-4 text-slatex-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span>Buscar lugar o coordenadas</span>
                </button>

                {viewMode === "explore" && activeBodyId === "tierra" && (
                  <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-2">
                    {["luna", "marte"].map((id) => (
                      <button
                        key={id}
                        data-body={id}
                        onPointerEnter={() => preloadBody(id)}
                        onClick={() => handleNavigateBody(id)}
                        className="o-chip"
                      >
                        Explorar {CELESTIAL_BODIES[id].shortName}
                        <span className="text-mint-400" aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                )}

                {viewMode === "explore" && (
                  <div className="pointer-events-auto mt-3 flex flex-wrap gap-1.5 max-w-md" role="group" aria-label={`Regiones de ${activeBody.shortName}`}>
                    {regionsForActiveBody
                      .filter(
                        (reg) =>
                          !reg.isPeru ||
                          [selectedRegion?.id, "SE-05", "AN-05"].includes(reg.id),
                      )
                      .map((reg) => (
                        <button
                          key={reg.id}
                          onClick={() => handleSelectRegion(reg, "chip")}
                          aria-pressed={selectedRegion?.id === reg.id}
                          className="o-chip min-h-[32px] px-2.5 text-[12px]"
                        >
                          {reg.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="orbita-camera-controls absolute bottom-4 left-5 sm:bottom-6 sm:left-8 z-10 flex flex-col gap-2">
                <div className="inline-flex items-center rounded-xl bg-space-850/90 backdrop-blur-md border border-space-700/90 p-1 shadow-xl" role="group" aria-label="Cámara">
                  <button
                    onClick={() => setZoomTrigger({ dir: "in", ts: Date.now() })}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-slatex-300 hover:text-white hover:bg-space-700 transition-colors font-semibold text-lg"
                    title="Acercar"
                    aria-label="Acercar"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setZoomTrigger({ dir: "out", ts: Date.now() })}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-slatex-300 hover:text-white hover:bg-space-700 transition-colors font-semibold text-lg"
                    title="Alejar"
                    aria-label="Alejar"
                  >
                    −
                  </button>
                  <button
                    onClick={() => setResetTrigger(Date.now())}
                    className="h-10 px-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-space-750 text-mint-400 hover:bg-mint-400/20 transition-colors text-xs font-semibold"
                    title="Restablecer la vista"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="2" x2="12" y2="5" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="5" y2="12" />
                      <line x1="19" y1="12" x2="22" y2="12" />
                    </svg>
                    <span className="hidden sm:inline">Restablecer</span>
                  </button>
                </div>
                {viewMode === "system" && (
                  <div className="orbita-scale-note text-[11px] tracking-wider text-slatex-500 uppercase">
                    Tamaños a escala real / distancias no
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
              selectionOrigin={selectionOrigin}
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
          </section>

          {/* ---------- Comparación ---------- */}
          {(visited.compare || viewMode === "compare") && compareReady && (
            <section
              ref={panels.compare}
              tabIndex={-1}
              hidden={viewMode !== "compare"}
              aria-label="Comparación"
              className="o-panel absolute inset-0 focus:outline-none"
            >
              {!ComparisonView ? (
                <PanelFallback label="Preparando la comparación…" />
              ) : (
                <ComparisonView
                  activeBody={activeBody}
                  activeBodyId={activeBodyId}
                  selectedRegion={selectedRegion}
                  activeCandidateObj={activeCandidateObj}
                  activeAnalog={activeAnalog}
                  rankedCandidates={rankedCandidates}
                  selectedAnalogIndex={selectedAnalogIndex}
                  onSelectCandidate={handleSelectCandidate}
                  candidateOrigin={candidateOrigin}
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
                  isVisible={viewMode === "compare"}
                  handleSelectRegion={handleSelectRegion}
                  handleOpenTerrain={handleOpenTerrain}
                  setViewMode={setViewMode}
                  setIsConfigOpen={setIsConfigOpen}
                />
              )}
            </section>
          )}

          {/* ---------- Conoce tu terreno ---------- */}
          {terrainTarget && (
            <section
              ref={panels.terrain}
              tabIndex={-1}
              hidden={viewMode !== "terrain"}
              aria-label="Conoce tu terreno"
              className="o-panel absolute inset-0 focus:outline-none"
            >
              {!TerrainWorkspace ? (
                <PanelFallback label="Abriendo GeoPendiente…" />
              ) : (
                <TerrainWorkspace
                  target={terrainTarget}
                  references={sectorCatalog.referencias}
                  isVisible={viewMode === "terrain"}
                  returnLabel={
                    returnView === "compare"
                      ? "Volver a la comparación"
                      : returnView === "system"
                        ? "Volver al sistema planetario"
                        : `Volver a ${activeBody.shortName}`
                  }
                  onClose={() => setViewMode(returnView)}
                  onChangeMission={handleTerrainMission}
                />
              )}
            </section>
          )}
        </main>

        <footer className="h-12 flex-shrink-0 bg-space-950/95 border-t border-space-800 px-3 sm:px-8 grid grid-cols-4 gap-2 sm:gap-4 items-center z-20" aria-label="Recorrido">
          {[
            { step: 1, label: "01 Elige un mundo", short: "01 Mundo", onClick: handleNavigateSystem },
            { step: 2, label: "02 Explora una región", short: "02 Región", onClick: () => setViewMode("explore") },
            {
              step: 3,
              label: activeBodyId === "tierra" ? "03 Compara con Luna / Marte" : "03 Compara con la Tierra",
              short: "03 Compara",
              onClick: () => handleOpenComparison(),
            },
            { step: 4, label: "04 Conoce tu terreno", short: "04 Terreno", onClick: () => handleOpenTerrain() },
          ].map((s) => {
            const isActive = currentStep === s.step;
            return (
              <button
                key={s.step}
                onClick={s.onClick}
                aria-current={isActive ? "step" : undefined}
                disabled={s.step === 3 && rankedCandidates.length === 0}
                className={`relative h-full flex items-center text-[11px] font-semibold tracking-wider uppercase transition-colors duration-180 min-w-0 ${
                  isActive ? "text-mint-400" : "text-slatex-500 hover:text-slatex-300"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-0 right-2 h-[2px] bg-mint-400 shadow-[0_0_8px_var(--accent)]" />
                )}
                <span className="truncate sm:hidden">{s.short}</span>
                <span className="truncate hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </footer>
      </div>

      {isSearchOpen && (
        <SearchDialog
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredSearchRegions={filteredSearchRegions}
          setIsSearchOpen={setIsSearchOpen}
          handleSelectRegion={(region) => handleSelectRegion(region, "search")}
          setActiveBodyId={setActiveBodyId}
          setFocusedSystemBodyId={setFocusedSystemBodyId}
          setViewMode={setViewMode}
          handleSurfaceProbe={handleSurfaceProbe}
        />
      )}

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
            className="o-swap w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-space-800 border border-space-600/80 shadow-2xl p-6 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="o-subtitle">Fuentes de datos 3D y APIs científicas</h2>
                <p className="mt-1 text-xs text-slatex-400">
                  Procedencia de las capas orbitales, la telemetría y las
                  mediciones.
                </p>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="w-10 h-10 rounded-xl bg-space-700/80 hover:bg-space-600 text-slatex-300 flex items-center justify-center"
                aria-label="Cerrar fuentes"
              >
                ✕
              </button>
            </div>

            <SourceDirectory dataState={dataState} />

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setIsConfigOpen(false)} className="o-btn-primary">
                Continuar explorando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
