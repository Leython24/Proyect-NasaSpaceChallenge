import { useEffect, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  ImageOverlay,
  MapContainer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { CRS } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Globe, layers } from "./Globe.jsx";
import { formatScore } from "./similarity.js";
import { accentOf, prefersReducedMotion } from "./theme.js";

const worldBounds = [
  [-90, -180],
  [90, 180],
];

function FrameMap({ activeRegion }) {
  const map = useMap();
  useEffect(() => {
    if (activeRegion?.sector?.geometria) {
      const geometry = activeRegion.sector.geometria;
      const points =
        geometry.type === "MultiPolygon"
          ? geometry.coordinates.flat(2)
          : geometry.coordinates.flat();
      // Encuadre breve (≈250 ms) hacia el polígono elegido; inmediato con movimiento reducido.
      map.fitBounds(
        points.map(([lon, lat]) => [lat, lon]),
        { padding: [30, 30], maxZoom: 12, animate: !prefersReducedMotion(), duration: 0.25 },
      );
    } else {
      map.setView(
        [activeRegion.lat, activeRegion.lon],
        activeRegion.body === "tierra" ? 4 : 2,
        { animate: !prefersReducedMotion(), duration: 0.25 },
      );
    }
  }, [map, activeRegion]);
  useEffect(() => {
    const observer = new ResizeObserver(() =>
      map.invalidateSize({ pan: false }),
    );
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export function CandidateOverviewMap({
  candidates,
  selectedIndex,
  onSelectCandidate,
  display,
  accentBody,
}) {
  const accent = accentOf(accentBody).strong;
  const [zoom, setZoom] = useState(null);
  const [reset, setReset] = useState(null);
  const activeRegion = (candidates[selectedIndex] ?? candidates[0]).region;
  const body = activeRegion.body;
  const points = candidates.filter(({ region }) => region.body === body);
  const indexOf = (id) =>
    candidates.findIndex(({ region }) => region.id === id);
  const select = (id) => onSelectCandidate(indexOf(id));

  if (display === "globe") {
    return (
      <div
        className="orbita-candidate-globe"
        aria-label="Globo 3D de candidatos"
      >
        <Globe
          key={body}
          body={body}
          focus={activeRegion}
          initialZoom={1.18}
          regions={points
            .map(({ region }) => region)
            .filter(
              (region) => !region.isPeru || region.id === activeRegion.id,
            )}
          onSelect={(region) => select(region.id)}
          zoomTrigger={zoom}
          resetTrigger={reset}
        />
        <div className="absolute top-3 left-3 flex flex-col overflow-hidden rounded-lg border border-space-600 bg-space-850 text-lg">
          <button
            type="button"
            aria-label="Acercar el globo de candidatos"
            className="px-3 py-1"
            onClick={() => setZoom({ dir: "in" })}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Alejar el globo de candidatos"
            className="px-3 py-1"
            onClick={() => setZoom({ dir: "out" })}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Centrar el globo de candidatos"
            className="px-3 py-1"
            onClick={() => setReset({})}
          >
            ⊙
          </button>
        </div>
        <div className="orbita-map-credit">{layers[body].optical[1]}</div>
      </div>
    );
  }
  const earth = body === "tierra";
  return (
    <div className="h-72 overflow-hidden rounded-2xl border border-space-700/80">
      <MapContainer
        key={body}
        crs={CRS.EPSG4326}
        center={[activeRegion.lat, activeRegion.lon]}
        zoom={2}
        minZoom={1}
        maxZoom={earth ? 16 : 6}
        className="h-full w-full"
        scrollWheelZoom={false}
        maxBounds={worldBounds}
      >
        <ImageOverlay
          url={`/assets/${layers[body].optical[0]}.webp`}
          bounds={worldBounds}
          attribution={layers[body].optical[1]}
        />
        {earth && activeRegion.isPeru && (
          <ImageOverlay
            url="/assets/peru.webp"
            bounds={[
              [-22, -89],
              [4, -61],
            ]}
            attribution="NASA Blue Marble · Natural Earth"
          />
        )}
        <FrameMap activeRegion={activeRegion} />
        {points.map(({ region, scores }) => {
          const active = region.id === activeRegion.id;
          const caption = `#${indexOf(region.id) + 1} ${region.name}${scores.overall !== null ? ` · ${formatScore(scores.overall)}` : ""}`;
          const events = { click: () => select(region.id) };
          // El polígono activo se vuelve a crear con una pulsación breve para que
          // se vea qué selección produjo el cambio.
          return region.sector?.geometria ? (
            <GeoJSON
              key={`${region.id}-${active ? "on" : "off"}`}
              data={region.sector.geometria}
              eventHandlers={events}
              className={active ? "o-active-shape" : undefined}
              style={{
                color: active ? accent : "#92b1c6",
                fillColor: active ? accent : "#92b1c6",
                fillOpacity: active ? 0.4 : 0.12,
                weight: active ? 3 : 1,
              }}
            >
              <Tooltip>{caption}</Tooltip>
            </GeoJSON>
          ) : (
            <CircleMarker
              key={region.id}
              center={[region.lat, region.lon]}
              radius={active ? 9 : 6}
              pathOptions={{ color: accent, fillColor: accent, fillOpacity: active ? 1 : 0.28, weight: active ? 3 : 1.5 }}
              eventHandlers={events}
            >
              <Tooltip permanent={active} direction="right">
                {caption}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
