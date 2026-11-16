import { useEffect, useState } from "react";
import { ArrowRight, Hand, Layers, Mountain, Move3d } from "lucide-react";
import { CELESTIAL_BODIES } from "./catalog.js";
import { Globe, layers, preloadBody } from "./Globe.jsx";
import { clamp } from "./geography.js";
import { AtlasImage } from "./Evidence.jsx";

const lineup = ["marte", "luna", "tierra"];

// Radios medios reales (km). Los tamaños del sistema son proporcionales a ellos:
// la Tierra es la referencia, Marte mide ~53 % de ella y la Luna ~27 %.
const RADIUS_KM = { tierra: 6371, marte: 3389.5, luna: 1737.4 };
const EARTH_SHARE = 46; // % del ancho de la fila que ocupa la Tierra
const worldWidth = (id) =>
  `${((EARTH_SHARE * RADIUS_KM[id]) / RADIUS_KM.tierra).toFixed(2)}%`;
// Grados por segundo de la rotación decorativa (lenta, distinta en cada cuerpo).
const SPIN = { tierra: 7, marte: 6, luna: 3 };

export function PlanetaryThreeViewport({
  focusedSystemBodyId,
  onSelectSystemBody,
  onFocusSystemBody,
  zoomTrigger,
  resetTrigger,
}) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (zoomTrigger)
      setScale((value) =>
        clamp(value * (zoomTrigger.dir === "in" ? 1.14 : 0.88), 0.65, 1.45),
      );
  }, [zoomTrigger]);
  useEffect(() => {
    if (resetTrigger) setScale(1);
  }, [resetTrigger]);

  return (
    <div className="orbita-system" aria-label="Sistema planetario">
      {/* Decoración animada: nebulosa, dos capas de estrellas, meteoros y el
          brillo que recorre la órbita. Solo CSS; se congela con movimiento reducido. */}
      <div className="orbita-space" aria-hidden="true">
        <div className="orbita-nebula" />
        <div className="orbita-stars-far" />
        <div className="orbita-stars-near" />
        <span className="orbita-meteor" />
        <span className="orbita-meteor orbita-meteor-2" />
      </div>
      <div className="orbita-orbit" aria-hidden="true" />
      <div className="orbita-lineup" style={{ "--system-scale": scale }}>
        {lineup.map((id) => (
          <button
            key={id}
            type="button"
            data-body={id}
            style={{ width: worldWidth(id) }}
            className={`orbita-world orbita-world-${id} ${id === focusedSystemBodyId ? "is-focused" : ""}`}
            aria-label={`Explorar ${CELESTIAL_BODIES[id].shortName}`}
            onFocus={() => onFocusSystemBody(id)}
            onMouseEnter={() => onFocusSystemBody(id)}
            onClick={() => onSelectSystemBody(id)}
          >
            <Globe body={id} interactive={false} spin={SPIN[id]} />
            <span
              className={`orbita-world-label ${id === focusedSystemBodyId ? "text-mint-300" : "text-white"}`}
            >
              {CELESTIAL_BODIES[id].shortName}
            </span>
            <span className="orbita-world-note">
              {CELESTIAL_BODIES[id].subtitle}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const layerLabels = (bodyId) => [
  ["optical", bodyId === "tierra" ? "Satélite HD" : "Mosaico óptico"],
  ["elevation", bodyId === "tierra" ? "Relieve NASA" : "Altimetría DEM"],
  ["scientific", bodyId === "tierra" ? "NASA GIBS" : "Orbital NASA"],
];

export function PlanetaryExploreGlobe({
  bodyId,
  regions,
  selectedRegion,
  onSelectRegion,
  onSurfaceProbe,
  zoomTrigger,
  resetTrigger,
  candidateCount = 0,
  onOpenComparison,
}) {
  const [layer, setLayer] = useState("optical");
  const [tilted, setTilted] = useState(false);
  const [showOrbitalPhoto, setShowOrbitalPhoto] = useState(false);
  const [freeRotate, setFreeRotate] = useState(false);
  const [touched, setTouched] = useState(false);
  const markers = regions.filter(
    (region) =>
      !region.isPeru ||
      region.id === selectedRegion?.id ||
      region.id === "AN-05" ||
      region.id === "SE-05",
  );
  if (selectedRegion?.isCustomProbe) markers.push(selectedRegion);

  // El mismo globo se reutiliza entre planetas: al cambiar de cuerpo vuelve a la
  // capa óptica y cierra la foto orbital del cuerpo anterior.
  useEffect(() => {
    setLayer("optical");
    setShowOrbitalPhoto(false);
  }, [bodyId]);
  useEffect(() => {
    setShowOrbitalPhoto(false);
  }, [selectedRegion?.id]);
  // Precarga las capas del cuerpo activo cuando el navegador queda libre.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 600));
    const handle = idle(() => preloadBody(bodyId));
    return () => (window.cancelIdleCallback ?? clearTimeout)(handle);
  }, [bodyId]);

  return (
    <div
      className={`orbita-surface ${freeRotate ? "is-free-rotate" : ""}`}
      onPointerDown={() => setTouched(true)}
    >
      <Globe
        body={bodyId}
        layer={layer}
        focus={selectedRegion}
        regions={markers}
        initialZoom={1.23}
        zoomTrigger={zoomTrigger}
        resetTrigger={resetTrigger}
        tilted={tilted}
        showStatus
        onSelect={(region) => {
          if (!region.isCustomProbe) onSelectRegion(region, "globe");
        }}
        onProbe={onSurfaceProbe}
      />
      {showOrbitalPhoto && selectedRegion && (
        <div className="orbita-photo glass-panel o-swap">
          <AtlasImage
            item={selectedRegion}
            className="h-32 w-full rounded-xl object-cover"
          />
          <div className="mt-1 flex justify-between gap-3 text-[11px] text-slatex-300">
            <span>
              {selectedRegion.name} · {selectedRegion.dataSource}
            </span>
            <button
              type="button"
              className="text-mint-300"
              onClick={() => setShowOrbitalPhoto(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
      <div className="orbita-layer-controls">
        {selectedRegion && (
          <div
            key={selectedRegion.id}
            className="o-swap glass-panel flex max-w-[min(100%,360px)] items-center gap-3 rounded-xl px-3 py-2"
          >
            <span className="min-w-0">
              <span className="o-eyebrow block">Región seleccionada</span>
              <span className="block truncate text-sm font-semibold text-white">
                {selectedRegion.name}
              </span>
            </span>
            {candidateCount > 0 && onOpenComparison && (
              <button
                type="button"
                onClick={() => onOpenComparison()}
                className="o-btn-primary min-h-[38px] flex-shrink-0 px-3 text-xs"
              >
                Comparar <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <div
          className="orbita-layer-buttons"
          role="group"
          aria-label="Capas del globo"
        >
          <span className="hidden items-center pl-1.5 pr-1 text-slatex-400 sm:inline-flex">
            <Layers size={14} aria-hidden="true" />
          </span>
          {layerLabels(bodyId).map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={layer === id}
              onClick={() => {
                setLayer(id);
                if (id !== "scientific") setShowOrbitalPhoto(false);
                if (id === "scientific" && bodyId !== "tierra") {
                  setShowOrbitalPhoto(true);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="orbita-layer-summary">
          {!touched && (
            <span className="orbita-gesture-hint o-swap">
              <Move3d size={14} aria-hidden="true" />
              <span className="orbita-hint-fine">Arrastra para girar · toca un marcador</span>
              <span className="orbita-hint-coarse">Desliza en horizontal para girar</span>
            </span>
          )}
          <button
            type="button"
            className="orbita-touch-only"
            aria-pressed={freeRotate}
            onClick={() => setFreeRotate((value) => !value)}
            title="En pantallas táctiles, alterna entre girar libremente y desplazar la página"
          >
            <Hand size={13} aria-hidden="true" />
            {freeRotate ? "Giro libre activo" : "Giro libre"}
          </button>
          <button
            type="button"
            aria-pressed={tilted}
            onClick={() => setTilted((value) => !value)}
          >
            <Mountain size={13} aria-hidden="true" />{" "}
            {tilted ? "Vista inclinada" : "Inclinar horizonte 3D"}
          </button>
          <span>{layers[bodyId][layer][1]}</span>
        </div>
      </div>
    </div>
  );
}
