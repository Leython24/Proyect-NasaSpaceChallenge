const weights = {
  geological: 0.35,
  topographic: 0.25,
  thermal: 0.2,
  environmental: 0.2,
};
export const criterionLabels = {
  overall: "Índice general",
  geological: "Geología",
  topographic: "Topografía",
  thermal: "Temperatura",
  environmental: "Ambiente",
};

export const formatScore = (value) =>
  Number.isFinite(value) ? `${value}%` : "—";
export const formatDeg = (value) =>
  Number.isFinite(value) ? `${value}°` : "—";
export const formatRatio = (value) =>
  Number.isFinite(value) ? formatScore(Math.round(value * 100)) : "—";

function cosine(a, b) {
  if (!a || !b) return null;
  const keys = Object.keys({ ...a, ...b });
  const norm = (profile) => Math.hypot(...keys.map((key) => profile[key] ?? 0));
  const divisor = norm(a) * norm(b);
  return divisor
    ? keys.reduce((total, key) => total + (a[key] ?? 0) * (b[key] ?? 0), 0) /
        divisor
    : null;
}

function similarity(a, b, range) {
  return Number.isFinite(a) && Number.isFinite(b)
    ? Math.max(0, 1 - Math.abs(a - b) / range)
    : null;
}

function temperatureCenter(region) {
  return [region.tempMinC, region.tempMaxC].every(Number.isFinite)
    ? (region.tempMinC + region.tempMaxC) / 2
    : null;
}

function dimensionValues(left, right) {
  if (left.isPeru || right.isPeru) return {};
  const aridity = similarity(left.aridityScore, right.aridityScore, 1);
  const ice = similarity(left.icePotentialScore, right.icePotentialScore, 1);
  const slope = similarity(left.slopeMeanDeg, right.slopeMeanDeg, 45);
  const shape =
    left.reliefShort?.split(" ")[0] === right.reliefShort?.split(" ")[0];
  return {
    geological: cosine(left.geologyProfile, right.geologyProfile),
    topographic: slope === null ? null : slope * 0.86 + (shape ? 0.14 : 0),
    thermal: similarity(temperatureCenter(left), temperatureCenter(right), 210),
    environmental:
      aridity === null || ice === null ? null : aridity * 0.55 + ice * 0.45,
  };
}

export function computeAnalogCandidates(
  source,
  catalog,
  criterion = "overall",
  scope = "all",
) {
  if (!source || source.isCustomProbe) return [];
  const candidates = catalog.filter((region) => {
    if (source.isPeru) return source.analogIds.includes(region.id);
    if (source.body === "tierra") return region.body !== "tierra";
    if (region.body !== "tierra") return false;
    return scope === "all"
      ? !region.isPeru
      : region.isPeru && region.analogIds?.includes(source.id);
  });

  return candidates
    .map((region) => {
      const values = dimensionValues(source, region);
      const dimensions = Object.keys(weights);
      const scores = Object.fromEntries(
        dimensions.map((key) => [
          key,
          Number.isFinite(values[key]) ? Math.round(values[key] * 100) : null,
        ]),
      );
      scores.overall = dimensions.every((key) => Number.isFinite(values[key]))
        ? Math.round(
            dimensions.reduce(
              (sum, key) => sum + values[key] * weights[key],
              0,
            ) * 100,
          )
        : null;
      const ordered = dimensions
        .filter((key) => scores[key] !== null)
        .sort((a, b) => scores[b] - scores[a]);
      const territory = source.isPeru ? source : region.isPeru ? region : null;
      const matchingVariables = ordered
        .filter((key) => scores[key] >= 72)
        .map(
          (key) =>
            `${criterionLabels[key]} · ${scores[key]} % en el modelo exploratorio`,
        );
      const differingVariables = ordered
        .filter((key) => scores[key] < 72)
        .map(
          (key) =>
            `${criterionLabels[key]} · ${scores[key]} % en el modelo exploratorio`,
        );
      differingVariables.push(
        source.body === "luna" || region.body === "luna"
          ? "Gravedad, vacío y condiciones de iluminación lunar."
          : "Gravedad y atmósfera marciana.",
      );
      if (territory) differingVariables.push(territory.comparisonSubtext);
      return {
        scores,
        region,
        matchingVariables,
        differingVariables,
        primaryDimensionLabel: ordered.length
          ? criterionLabels[ordered[0]]
          : "Mediciones por sector",
        summary: territory?.comparisonSummary,
      };
    })
    .sort(
      (a, b) =>
        (b.scores[criterion] ?? -1) - (a.scores[criterion] ?? -1) ||
        a.region.name.localeCompare(b.region.name, "es"),
    );
}
