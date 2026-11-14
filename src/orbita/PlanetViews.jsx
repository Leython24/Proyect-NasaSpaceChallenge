import { useEffect, useState } from "react";
import { Mountain } from "lucide-react";
import { CELESTIAL_BODIES } from "./catalog.js";
import { Globe, layers } from "./Globe.jsx";
import { clamp } from "./geography.js";
import { AtlasImage } from "./Evidence.jsx";

const lineup = ["marte", "luna", "tierra"];

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
      <div className="orbita-orbit" aria-hidden="true" />
      <div className="orbita-lineup" style={{ "--system-scale": scale }}>
        {lineup.map((id) => (
          <button
            key={id}
            type="button"
            className={`orbita-world orbita-world-${id}`}
            aria-label={`Explorar ${CELESTIAL_BODIES[id].shortName}`}
            onFocus={() => onFocusSystemBody(id)}
            onMouseEnter={() => onFocusSystemBody(id)}
            onClick={() => onSelectSystemBody(id)}
          >
            <Globe body={id} interactive={false} />
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

export function PlanetaryExploreGlobe({
  bodyId,
  regions,
  selectedRegion,
  onSelectRegion,
  onSurfaceProbe,
  zoomTrigger,
  resetTrigger,
}) {
  const [layer, setLayer] = useState("optical");
  const [tilted, setTilted] = useState(false);
  const [showOrbitalPhoto, setShowOrbitalPhoto] = useState(false);
  const controls = [
    ["optical", bodyId === "tierra" ? "Satélite HD" : "Mosaico Óptico"],
    ["elevation", bodyId === "tierra" ? "Relieve NASA" : "Altimetría DEM"],
    ["scientific", bodyId === "tierra" ? "NASA GIBS" : "Orbital NASA"],
  ];
  const markers = regions.filter(
    (region) =>
      !region.isPeru ||
      region.id === selectedRegion?.id ||
      region.id === "AN-05" ||
      region.id === "SE-05",
  );
  if (selectedRegion?.isCustomProbe) markers.push(selectedRegion);

  useEffect(() => {
    setShowOrbitalPhoto(false);
  }, [selectedRegion?.id]);

  return (
    <div className="orbita-surface">
      <Globe
        body={bodyId}
        layer={layer}
        focus={selectedRegion}
        regions={markers}
        initialZoom={1.23}
        zoomTrigger={zoomTrigger}
        resetTrigger={resetTrigger}
        tilted={tilted}
        onSelect={(region) => {
          if (!region.isCustomProbe) onSelectRegion(region);
        }}
        onProbe={onSurfaceProbe}
      />
      {showOrbitalPhoto && selectedRegion && (
        <div className="orbita-photo glass-panel">
          <AtlasImage
            item={selectedRegion}
            className="h-32 w-full rounded-xl object-cover"
          />
          <div className="mt-1 flex justify-between gap-3 text-[10px] text-slatex-300">
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
        <div className="orbita-layer-buttons" aria-label="Capas del globo">
          {controls.map(([id, label]) => (
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
          <button
            type="button"
            aria-pressed={tilted}
            onClick={() => setTilted((value) => !value)}
          >
            <Mountain size={13} />{" "}
            {tilted ? "Vista inclinada" : "Inclinar horizonte 3D"}
          </button>
          <span>{layers[bodyId][layer][1]}</span>
        </div>
      </div>
    </div>
  );
}
