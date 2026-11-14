export const radians = Math.PI / 180;
export const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));
export const wrapLongitude = (value) =>
  ((((value + 180) % 360) + 360) % 360) - 180;
export const searchable = (value) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function parseCoordinateInput(raw) {
  const number = "[+-]?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)";
  const cardinals = raw
    .trim()
    .match(
      new RegExp(
        "^(" +
          number +
          ")\\s*°?\\s*([NS])\\s*[,;· ]*\\s*(" +
          number +
          ")\\s*°?\\s*([EOW])$",
        "i",
      ),
    );
  const signed =
    raw.trim().match(/^([+-]?\d+(?:\.\d+)?)[ ,;]+([+-]?\d+(?:\.\d+)?)$/) ??
    raw.trim().match(/^([+-]?\d+,\d+)\s*[; ]\s*([+-]?\d+,\d+)$/);
  if (!cardinals && !signed) return null;
  const decimal = (part) => Number(part.replace(",", "."));
  const lat = cardinals
    ? Math.abs(decimal(cardinals[1])) * (/S/i.test(cardinals[2]) ? -1 : 1)
    : decimal(signed[1]);
  const lon = cardinals
    ? Math.abs(decimal(cardinals[3])) * (/[OW]/i.test(cardinals[4]) ? -1 : 1)
    : decimal(signed[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

const coordinateNumber = new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCoords(lat, lon) {
  return `${coordinateNumber.format(Math.abs(lat))}° ${lat < 0 ? "S" : "N"} · ${coordinateNumber.format(Math.abs(lon))}° ${lon < 0 ? "O" : "E"}`;
}

export function angularDistance(a, b) {
  const sinLat = Math.sin(((a.lat - b.lat) * radians) / 2);
  const sinLon = Math.sin(((a.lon - b.lon) * radians) / 2);
  const haversine =
    sinLat ** 2 +
    Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * sinLon ** 2;
  return (2 * Math.asin(Math.sqrt(clamp(haversine, 0, 1)))) / radians;
}

export function makeProbe(body, lat, lon, catalog) {
  const location = { lat, lon };
  const nearest = catalog
    .filter((region) => region.body === body && !region.isPeru)
    .reduce(
      (best, region) =>
        !best ||
        angularDistance(region, location) < angularDistance(best, location)
          ? region
          : best,
      null,
    );
  const coordsText = formatCoords(lat, lon);
  return {
    ...location,
    id: `probe_${body}_${lat}_${lon}`,
    body,
    coordsText,
    nearest,
    isCustomProbe: true,
    name: `Coordenada ${coordsText}`,
    countryOrBody: "Punto seleccionado en el globo",
    terrainType: "Sin caracterización en el catálogo",
    elevation: "Sin datos",
    slope: "Sin datos",
    temperature: "Sin datos",
    waterIce: "Sin datos",
    mineralogy: "Sin datos",
    tags: ["Coordenada"],
    dataSource:
      body === "tierra"
        ? "Open-Meteo · consulta por coordenadas"
        : "Posición en el globo orbital",
    geologyNotes:
      "Selecciona una región catalogada para comparar el terreno. La ficha del punto puede mostrar datos de contexto cuando están disponibles.",
  };
}

async function query(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Servicio de contexto no disponible");
  return response.json();
}

export async function fetchEarthContext(lat, lon, signal) {
  const coords = new URLSearchParams({
    latitude: lat.toFixed(5),
    longitude: lon.toFixed(5),
  });
  const [elevation, weather] = await Promise.allSettled([
    query(`https://api.open-meteo.com/v1/elevation?${coords}`, signal),
    query(
      `https://api.open-meteo.com/v1/forecast?${coords}&current=temperature_2m,relative_humidity_2m`,
      signal,
    ),
  ]);
  const height = elevation.value?.elevation?.[0];
  const current = weather.value?.current;
  const time = current?.time?.replace("T", " ");
  return {
    elevation: Number.isFinite(height)
      ? `${height} m (Copernicus DEM)`
      : "Sin datos disponibles",
    temperature: Number.isFinite(current?.temperature_2m)
      ? `${current.temperature_2m} °C a 2 m${time ? ` · ${time} UTC` : ""}`
      : "Sin datos disponibles",
  };
}
