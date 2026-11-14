import { useEffect, useRef, useState } from "react";
import { Mountain } from "lucide-react";
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

function TerrainCanvas({ grid, name }) {
  const canvas = useRef();
  const drag = useRef();
  const [view, setView] = useState({ angle: -0.43, pitch: 0.61, zoom: 1 });

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
    setView((previous) => ({
      ...previous,
      angle: previous.angle + horizontal,
      pitch: clamp(previous.pitch + vertical, 0.22, 1.55),
    }));
  }

  return (
    <>
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slatex-300">
        <span>
          {grid.credit} · {grid.extentKm.join(" × ")} km · exageración vertical
          ×4
        </span>
        <div className="flex gap-1">
          {[
            [0.85, "Alejar relieve", "−"],
            [1.18, "Acercar relieve", "+"],
          ].map(([factor, title, label]) => (
            <button
              type="button"
              aria-label={title}
              key={title}
              className="rounded bg-space-700 px-2 text-base"
              onClick={() =>
                setView((previous) => ({
                  ...previous,
                  zoom: clamp(previous.zoom * factor, 0.55, 2.2),
                }))
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function TerrainFigure({ id, name }) {
  const [grid, setGrid] = useState(undefined);
  useEffect(() => {
    const request = new AbortController();
    fetch(`/assets/terrain-${id}.json`, { signal: request.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Relieve no disponible");
        return response.json();
      })
      .then(setGrid)
      .catch(() => {
        if (!request.signal.aborted) setGrid(null);
      });
    return () => request.abort();
  }, [id]);

  if (grid === undefined)
    return (
      <p className="py-5 text-xs text-slatex-300">
        Cargando el modelo de elevación…
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
        className="flex w-full items-center gap-2 rounded-xl border border-mint-400/30 bg-mint-400/10 px-3 py-2 text-xs font-semibold text-mint-300"
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
