import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Crosshair } from "lucide-react";
import { clamp, radians, wrapLongitude } from "./geography.js";
import { prefersReducedMotion } from "./theme.js";

export const layers = {
  luna: {
    optical: ["moon-optical", "LRO WAC · NASA Moon Trek"],
    elevation: ["moon-dem", "LOLA, altimetría en color · NASA Moon Trek"],
    scientific: ["moon-optical", "LRO WAC · NASA Moon Trek"],
  },
  marte: {
    optical: ["mars-optical", "Viking MDIM 2.1 · NASA Mars Trek"],
    elevation: ["mars-dem", "MOLA, altimetría en color · NASA Mars Trek"],
    scientific: ["mars-optical", "Viking MDIM 2.1 · NASA Mars Trek"],
  },
  tierra: {
    optical: ["earth", "Blue Marble Next Generation · NASA GIBS"],
    elevation: ["earth-relief", "Blue Marble Shaded Relief · NASA GIBS"],
    scientific: ["earth-viirs", "VIIRS Suomi NPP · NASA GIBS · 15/06/2024 UTC"],
  },
};
const radiusFraction = 0.475;
const daylight = [-0.44, 0.49, 0.75];
const imageCache = new Map();
const zoomLimits = [0.68, 5.2];

/** Descarga y decodifica una textura una sola vez (también sirve para precargar). */
export function getImage(source) {
  if (!imageCache.has(source)) {
    imageCache.set(
      source,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Capa de imagen no disponible"));
        image.src = source;
      }).catch((error) => {
        imageCache.delete(source);
        throw error;
      }),
    );
  }
  return imageCache.get(source);
}

function hardware(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.z = 8;
  scene.add(new THREE.AmbientLight(0xffffff, 1.65));
  const light = new THREE.DirectionalLight(0xffffff, 2.15);
  light.position.set(...daylight);
  scene.add(light);
  const surface = new THREE.SphereGeometry(1, 96, 64).rotateY(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ roughness: 1 });
  const sphere = new THREE.Mesh(surface, material);
  scene.add(sphere);
  // Texturas ya subidas a la GPU: volver a un cuerpo o capa visitada no repite la subida.
  const uploaded = new Map();

  return {
    texture(image) {
      let map = uploaded.get(image.src);
      if (!map) {
        map = new THREE.Texture(image);
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        map.needsUpdate = true;
        uploaded.set(image.src, map);
        if (uploaded.size > 6) {
          const [oldest, texture] = uploaded.entries().next().value;
          if (texture !== material.map) {
            texture.dispose();
            uploaded.delete(oldest);
          }
        }
      }
      material.map = map;
      material.needsUpdate = true;
    },
    resize(size) {
      renderer.setSize(size, size, false);
    },
    draw({ lat, lon, zoom }) {
      if (!material.map) return;
      sphere.rotation.set(lat * radians, -lon * radians, 0);
      sphere.scale.setScalar(radiusFraction * 2 * zoom);
      renderer.render(scene, camera);
    },
    dispose() {
      surface.dispose();
      uploaded.forEach((texture) => texture.dispose());
      material.dispose();
      renderer.dispose();
    },
  };
}

function software(canvas) {
  const context = canvas.getContext("2d");
  let map, size;
  return {
    texture(image) {
      const pixels = document.createElement("canvas");
      pixels.width = image.naturalWidth;
      pixels.height = image.naturalHeight;
      const scratch = pixels.getContext("2d");
      scratch.drawImage(image, 0, 0);
      map = scratch.getImageData(0, 0, pixels.width, pixels.height);
    },
    resize(side) {
      canvas.width = side;
      canvas.height = side;
      size = side;
    },
    draw({ lat, lon, zoom }) {
      if (!map || !size) return;
      const sin = Math.sin(lat * radians);
      const cos = Math.cos(lat * radians);
      const frame = context.createImageData(size, size);
      const radius = size * radiusFraction * zoom;
      const center = (size - 1) * 0.5;
      for (let row = 0; row < size; row++) {
        const y = (center - row) / radius;
        for (let col = 0; col < size; col++) {
          const x = (col - center) / radius;
          const squared = x * x + y * y;
          if (squared > 1) continue;
          const z = Math.sqrt(1 - squared);
          const latitude = Math.asin(clamp(y * cos + z * sin, -1, 1));
          const longitude = wrapLongitude(
            lon + Math.atan2(x, z * cos - y * sin) / radians,
          );
          const u = Math.floor(((longitude + 180) / 360) * map.width);
          const v = clamp(
            Math.floor((0.5 - latitude / Math.PI) * map.height),
            0,
            map.height - 1,
          );
          const source = (v * map.width + u) * 4;
          const destination = (row * size + col) * 4;
          const light =
            0.51 +
            0.66 *
              Math.max(0, daylight[0] * x + daylight[1] * y + daylight[2] * z);
          frame.data[destination] = map.data[source] * light;
          frame.data[destination + 1] = map.data[source + 1] * light;
          frame.data[destination + 2] = map.data[source + 2] * light;
          frame.data[destination + 3] = clamp(
            (1 - Math.sqrt(squared)) * radius * 255,
            0,
            255,
          );
        }
      }
      context.putImageData(frame, 0, 0);
    },
    dispose() {},
  };
}

function project({ lat, lon }, view) {
  const phi = lat * radians;
  const lambda = (lon - view.lon) * radians;
  const tilt = view.lat * radians;
  const x = Math.cos(phi) * Math.sin(lambda);
  const y =
    Math.sin(phi) * Math.cos(tilt) -
    Math.cos(phi) * Math.cos(lambda) * Math.sin(tilt);
  const z =
    Math.sin(phi) * Math.sin(tilt) +
    Math.cos(phi) * Math.cos(lambda) * Math.cos(tilt);
  const left = 0.5 + x * radiusFraction * view.zoom;
  const top = 0.5 - y * radiusFraction * view.zoom;
  return z > 0 && left > 0.02 && left < 0.98 && top > 0.02 && top < 0.98
    ? { left: `${left * 100}%`, top: `${top * 100}%` }
    : null;
}

function unproject(event, view) {
  const box = event.currentTarget.getBoundingClientRect();
  const x =
    ((event.clientX - box.left) / box.width - 0.5) /
    (radiusFraction * view.zoom);
  const y =
    (0.5 - (event.clientY - box.top) / box.height) /
    (radiusFraction * view.zoom);
  if (x * x + y * y > 1) return null;
  const z = Math.sqrt(1 - x * x - y * y);
  const tilt = view.lat * radians;
  return [
    Math.asin(clamp(y * Math.cos(tilt) + z * Math.sin(tilt), -1, 1)) / radians,
    wrapLongitude(
      view.lon +
        Math.atan2(x, z * Math.cos(tilt) - y * Math.sin(tilt)) / radians,
    ),
  ];
}

/** Precarga la textura principal de un cuerpo (intención: hover o foco). */
export function preloadBody(body) {
  const optical = layers[body]?.optical?.[0];
  if (optical) getImage("/assets/" + optical + ".webp").catch(() => {});
}

const bodyNames = { tierra: "la Tierra", marte: "Marte", luna: "la Luna" };

// Antes de la primera interacción no hay clic que proteger: los globos de la
// vista inicial crean su contexto sin esperar un cuadro.
let userInteracted = false;
if (typeof window !== "undefined") {
  const mark = () => {
    userInteracted = true;
  };
  window.addEventListener("pointerdown", mark, { once: true, capture: true });
  window.addEventListener("keydown", mark, { once: true, capture: true });
}

const home = {
  tierra: { lat: -12, lon: -75 },
  marte: { lat: 12, lon: 115 },
  luna: { lat: -15, lon: 4 },
};

export function Globe({
  body,
  focus,
  regions = [],
  layer = "optical",
  zoomTrigger,
  resetTrigger,
  tilted = false,
  onSelect,
  onProbe,
  initialZoom = 1,
  interactive = true,
  showStatus = false,
  spin = 0,
  className = "",
}) {
  const [view, setView] = useState(() => ({
    lat: focus?.lat ?? home[body].lat,
    lon: focus?.lon ?? home[body].lon,
    zoom: initialZoom,
  }));
  const [mode, setMode] = useState("hardware");
  const [ready, setReady] = useState(false);
  const frame = useRef(view);
  const canvasRef = useRef();
  const scene = useRef();
  const gesture = useRef();
  const targetLat = focus?.lat;
  const targetLon = focus?.lon;
  const [asset] = layers[body][layer];
  const source = "/assets/" + asset + ".webp";

  // Al cambiar el foco (región, planeta o inclinación) el globo gira hacia él
  // en ~240 ms; con «movimiento reducido» el cambio es inmediato.
  useEffect(() => {
    const target = {
      lat: clamp((targetLat ?? home[body].lat) + (tilted ? -23 : 0), -90, 90),
      lon: targetLon ?? home[body].lon,
    };
    const from = frame.current;
    if (!interactive || prefersReducedMotion() || !from) {
      setView((previous) => ({ ...previous, ...target }));
      return undefined;
    }
    const deltaLon = ((target.lon - from.lon + 540) % 360) - 180;
    const start = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / 240);
      const eased = 1 - (1 - t) ** 3;
      setView((previous) => ({
        ...previous,
        lat: from.lat + (target.lat - from.lat) * eased,
        lon: wrapLongitude(from.lon + deltaLon * eased),
      }));
      if (t < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [targetLat, targetLon, body, tilted, interactive]);
  useEffect(() => {
    if (zoomTrigger)
      setView((previous) => ({
        ...previous,
        zoom: clamp(
          previous.zoom * (zoomTrigger.dir === "in" ? 1.23 : 1 / 1.23),
          ...zoomLimits,
        ),
      }));
  }, [zoomTrigger]);
  useEffect(() => {
    if (resetTrigger)
      setView({
        ...(focus ? { lat: focus.lat, lon: focus.lon } : home[body]),
        zoom: initialZoom,
      });
  }, [resetTrigger]);

  // El contexto WebGL se crea en el cuadro siguiente: crear un contexto puede
  // tardar cientos de ms y, si ocurre en el mismo ciclo del clic, retrasa el
  // primer dibujo del panel nuevo. Mientras tanto se ve el estado de carga.
  const [engineTick, setEngineTick] = useState(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    let engine, observer;
    const loseContext = (event) => {
      event.preventDefault();
      setMode("software");
    };
    const create = () => {
    try {
      engine = mode === "hardware" ? hardware(canvas) : software(canvas);
    } catch {
      if (mode === "hardware") setMode("software");
      return;
    }
    scene.current = engine;
    observer = new ResizeObserver(([entry]) => {
      // Un globo oculto (panel con display:none) mide 0: conserva su lienzo en vez
      // de reducirlo y volver a ampliarlo al mostrarse.
      if (entry.contentRect.width === 0) return;
      const maximum = mode === "hardware" ? 1400 : 580;
      engine.resize(clamp(Math.round(entry.contentRect.width), 90, maximum));
      if (frame.current) engine.draw(frame.current);
    });
    canvas.addEventListener("webglcontextlost", loseContext);
    observer.observe(canvas);
    setEngineTick((tick) => tick + 1);
    };
    const raf = userInteracted ? requestAnimationFrame(create) : (create(), 0);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      canvas.removeEventListener("webglcontextlost", loseContext);
      engine?.dispose();
      scene.current = null;
    };
  }, [mode]);

  useEffect(() => {
    let mounted = true;
    setReady(false);
    if (!scene.current) return undefined;
    const primary = "/assets/" + layers[body].optical[0] + ".webp";
    getImage(source)
      .catch(() => getImage(primary))
      .then((image) => {
        if (!mounted || !scene.current) return;
        scene.current.texture(image);
        scene.current.draw(frame.current);
        setReady(true);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [source, body, mode, engineTick]);

  useEffect(() => {
    frame.current = view;
    scene.current?.draw(view);
  }, [view]);

  // Rotación propia (solo decorativa, en globos sin interacción ni marcadores):
  // gira hacia el este a `spin` grados por segundo, a ~30 cuadros por segundo y
  // dibujando directo en el lienzo, sin pasar por el estado de React. Se detiene
  // con la pestaña oculta, con «movimiento reducido» y en el modo por software.
  useEffect(() => {
    if (!spin || !ready || interactive || mode !== "hardware") return undefined;
    if (prefersReducedMotion()) return undefined;
    let raf;
    let last = performance.now();
    const step = (now) => {
      raf = requestAnimationFrame(step);
      const elapsed = now - last;
      if (elapsed < 33 || document.hidden) return;
      last = now;
      const current = frame.current;
      if (!current || !scene.current) return;
      frame.current = {
        ...current,
        lon: wrapLongitude(current.lon - (spin * Math.min(elapsed, 100)) / 1000),
      };
      scene.current.draw(frame.current);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [spin, ready, interactive, mode]);

  function rotate(pitch, yaw) {
    setView((previous) => ({
      ...previous,
      lat: clamp(previous.lat + pitch, -90, 90),
      lon: wrapLongitude(previous.lon + yaw),
    }));
  }

  return (
    <div
      className={`orbita-sphere ${ready ? "" : "is-loading"} ${className}`}
      aria-busy={!ready || undefined}
    >
      <div className={ready ? "hidden" : "orbita-sphere-loading"} />
      {showStatus && !ready && (
        <div className="orbita-sphere-status" role="status">
          <span className="o-spinner" aria-hidden="true" />
          Cargando la superficie de {bodyNames[body]}…
        </div>
      )}
      <canvas
        key={mode}
        ref={canvasRef}
        className={interactive ? "orbita-grab" : ""}
        aria-label={
          interactive
            ? `Globo 3D de ${body}. Usa las flechas para girar.`
            : undefined
        }
        aria-hidden={!interactive || undefined}
        tabIndex={interactive ? 0 : undefined}
        onPointerDown={
          interactive
            ? (event) => {
                if (event.button !== 0) return;
                gesture.current = {
                  startX: event.clientX,
                  startY: event.clientY,
                  x: event.clientX,
                  y: event.clientY,
                  dragged: false,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }
            : undefined
        }
        onPointerMove={(event) => {
          const drag = gesture.current;
          if (!drag) return;
          if (
            !drag.dragged &&
            Math.hypot(
              event.clientX - drag.startX,
              event.clientY - drag.startY,
            ) < 4
          )
            return;
          drag.dragged = true;
          rotate(
            ((event.clientY - drag.y) * 0.34) / view.zoom,
            ((drag.x - event.clientX) * 0.39) / view.zoom,
          );
          drag.x = event.clientX;
          drag.y = event.clientY;
        }}
        onPointerUp={(event) => {
          const drag = gesture.current;
          gesture.current = null;
          if (!drag || drag.dragged || !onProbe) return;
          const coordinate = unproject(event, view);
          if (coordinate) onProbe(body, ...coordinate);
        }}
        onLostPointerCapture={() => {
          gesture.current = null;
        }}
        onKeyDown={(event) => {
          const delta = {
            ArrowUp: [8, 0],
            ArrowDown: [-8, 0],
            ArrowLeft: [0, -8],
            ArrowRight: [0, 8],
          }[event.key];
          if (!delta) return;
          event.preventDefault();
          rotate(...delta);
        }}
      />
      {regions.map((region) => {
        const style = project(region, view);
        const active = focus?.id === region.id;
        if (!style) return null;
        const label = region.isCustomProbe ? region.coordsText : region.name;
        return (
          <button
            key={region.id}
            type="button"
            style={style}
            className={`orbita-pin ${active ? "orbita-pin-active" : ""}`}
            aria-label={label}
            title={label}
            onClick={() => onSelect?.(region)}
          >
            <span className="orbita-pin-dot">
              <Crosshair size={14} />
            </span>
            <span className="orbita-pin-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
