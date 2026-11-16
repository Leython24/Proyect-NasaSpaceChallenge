import { useEffect, useRef, useState } from "react";
import { Minus, Mountain, Move3d, Plus, RotateCcw, RotateCw, ChevronUp, ChevronDown, Crosshair } from "lucide-react";
import { clamp } from "./geography.js";

const terrainNames = new Set(["shackleton", "jezero"]);
const palette = [
  [20, 44, 77],
  [38, 93, 133],
  [60, 148, 149],
  [102, 185, 152],
  [224, 199, 128],
  [240, 233, 189],
];

function color(value, shadow) {
  const sample = clamp(value, 0, 1) * (palette.length - 1);
  const index = Math.min(Math.floor(sample), palette.length - 2);
  const factor = sample - index;
  return (
    "rgb(" +
    palette[index]
      .map((channel, component) =>
        Math.round(
          (channel * (1 - factor) + palette[index + 1][component] * factor) *
            shadow,
        ),
      )
      .join(",") +
    ")"
  );
}

function renderTerrain(canvas, grid, view) {
  const context = canvas.getContext("2d");
  const { elevations, width, height, extentKm } = grid;
  const available = elevations.filter(Number.isFinite);
  const min = Math.min(...available),
    max = Math.max(...available);
  const span = Math.max(1, max - min);
  const largest = Math.max(...extentKm);
  const zoom = Math.min(canvas.width, canvas.height) * 0.82 * view.zoom;
  const pitch = view.pitch;
  const sin = Math.sin(view.angle);
  const cos = Math.cos(view.angle);
  const eye = Math.sin(pitch);
  const up = Math.cos(pitch);
  const points = elevations.map((elevation, index) => {
    if (!Number.isFinite(elevation)) return null;
    const x = (((index % width) / (width - 1) - 0.5) * extentKm[0]) / largest;
    const y =
      ((Math.floor(index / width) / (height - 1) - 0.5) * extentKm[1]) /
      largest;
    const z = ((elevation - (min + max) / 2) * 4) / (largest * 1000);
    const east = x * cos - y * sin;
    const north = x * sin + y * cos;
    return {
      x: canvas.width * 0.5 + east * zoom,
      y: canvas.height * 0.52 + (north * eye - z * up) * zoom,
      depth: north * up + z * eye,
    };
  });
  const cells = [];
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const index = y * width + x;
      const indices = [index, index + 1, index + width + 1, index + width];
      const vertices = indices.map((i) => points[i]);
      if (vertices.some((point) => !point)) continue;
      const average =
        indices.reduce((total, i) => total + elevations[i], 0) / 4;
      const shade = clamp(
        0.86 +
          (elevations[index] - elevations[index + width + 1]) / (span * 0.27),
        0.52,
        1.12,
      );
      cells.push({
        vertices,
        shade,
        value: (average - min) / span,
        depth: vertices.reduce((total, vertex) => total + vertex.depth, 0) / 4,
      });
    }
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  cells
    .sort((a, b) => a.depth - b.depth)
    .forEach(({ vertices, shade, value }) => {
      context.beginPath();
      context.moveTo(vertices[0].x, vertices[0].y);
      for (const vertex of vertices.slice(1))
        context.lineTo(vertex.x, vertex.y);
      context.closePath();
      context.fillStyle = color(value, shade);
      context.strokeStyle = context.fillStyle;
      context.lineWidth = 1;
      context.fill();
      context.stroke();
    });
}

const initialView = { angle: -0.43, pitch: 0.61, zoom: 1 };
// Las mallas ya descargadas se reutilizan al volver a abrir el relieve.
const gridCache = new Map();

function TerrainCanvas({ grid, name }) {
  const canvas = useRef();
  const drag = useRef();
  const [view, setView] = useState(initialView);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const draw = () => {
      const element = canvas.current;
      element.width = Math.max(320, Math.round(element.clientWidth * 1.5));
      element.height = 340;
      renderTerrain(element, grid, view);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [grid, view]);

  function rotate(horizontal, vertical) {
    setMoved(true);
    setView((previous) => ({
      ...previous,
      angle: previous.angle + horizontal,
      pitch: clamp(previous.pitch + vertical, 0.22, 1.55),
    }));
  }

  const zoomBy = (factor) =>
    setView((previous) => ({
      ...previous,
      zoom: clamp(previous.zoom * factor, 0.55, 2.2),
    }));
  const tools = [
    [RotateCcw, "Girar a la izquierda", () => rotate(-0.3, 0)],
    [RotateCw, "Girar a la derecha", () => rotate(0.3, 0)],
    [ChevronUp, "Inclinar hacia arriba", () => rotate(0, -0.15)],
    [ChevronDown, "Inclinar hacia abajo", () => rotate(0, 0.15)],
    [Minus, "Alejar relieve", () => zoomBy(0.85)],
    [Plus, "Acercar relieve", () => zoomBy(1.18)],
    [Crosshair, "Restablecer la vista", () => { setView(initialView); setMoved(false); }],
  ];

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1" role="toolbar" aria-label={`Controles del relieve de ${name}`}>
        {tools.map(([Icon, label, action]) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            onClick={action}
            className="grid h-9 w-9 place-items-center rounded-lg border border-space-700 bg-space-850 text-slatex-300 transition-colors duration-180 hover:border-mint-400/60 hover:text-white"
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="relative">
      {!moved && (
        <span className="orbita-gesture-hint pointer-events-none absolute left-2 top-2 z-10 o-swap">
          <Move3d size={13} aria-hidden="true" /> Arrastra para girar
        </span>
      )}
      <canvas
        ref={canvas}
        className="orbita-terrain orbita-grab"
        tabIndex={0}
        aria-label={`Relieve interactivo de ${name}. Usa las flechas para girar.`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          drag.current = [event.clientX, event.clientY];
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          rotate(
            (event.clientX - drag.current[0]) * 0.012,
            (event.clientY - drag.current[1]) * 0.008,
          );
          drag.current = [event.clientX, event.clientY];
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          const delta = {
            ArrowLeft: [-0.15, 0],
            ArrowRight: [0.15, 0],
            ArrowUp: [0, -0.12],
            ArrowDown: [0, 0.12],
          }[event.key];
          if (delta) {
            event.preventDefault();
            rotate(...delta);
          }
        }}
      />
      </div>
      <p className="o-legend">
        {grid.credit} · {grid.extentKm.join(" × ")} km · exageración vertical ×4
      </p>
    </>
  );
}

function TerrainFigure({ id, name }) {
  const [grid, setGrid] = useState(() => gridCache.get(id));
  useEffect(() => {
    if (gridCache.has(id)) {
      setGrid(gridCache.get(id));
      return undefined;
    }
    const request = new AbortController();
    fetch(`/assets/terrain-${id}.json`, { signal: request.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Relieve no disponible");
        return response.json();
      })
      .then((data) => {
        gridCache.set(id, data);
        setGrid(data);
      })
      .catch(() => {
        if (!request.signal.aborted) setGrid(null);
      });
    return () => request.abort();
  }, [id]);

  if (grid === undefined)
    return (
      <p className="flex items-center gap-2 py-5 text-xs text-slatex-300" role="status">
        <span className="o-spinner" aria-hidden="true" /> Cargando el modelo de elevación…
      </p>
    );
  if (!grid)
    return (
      <p className="py-5 text-xs text-slatex-300">
        El modelo de elevación no está disponible.
      </p>
    );
  return <TerrainCanvas grid={grid} name={name} />;
}

export function RegionTerrain({ region }) {
  const [openId, setOpenId] = useState(null);
  if (!terrainNames.has(region.id)) return null;
  const open = openId === region.id;
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        className="o-btn-ghost w-full justify-start"
        onClick={() => setOpenId(open ? null : region.id)}
      >
        <Mountain size={16} />{" "}
        {open ? "Ocultar relieve 3D" : "Explorar relieve 3D"}
      </button>
      {open && (
        <TerrainFigure key={region.id} id={region.id} name={region.name} />
      )}
    </div>
  );
}
