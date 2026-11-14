import test from "node:test";
import assert from "node:assert/strict";
import { computeAnalogCandidates } from "./similarity.js";

const jezero = { id: "jezero", body: "marte", name: "Jezero" };
const world = { id: "atacama", body: "tierra", name: "Atacama", analogIds: ["jezero"] };
const peru = { id: "SE-05", body: "tierra", name: "Sechura", analogIds: ["jezero"], isPeru: true };

test("the Peru filter only lists sectors paired with the selected reference", () => {
  const catalog = [jezero, world, peru];
  assert.deepEqual(computeAnalogCandidates(jezero, catalog, "overall", "peru").map(({ region }) => region.id), ["SE-05"]);
  assert.deepEqual(computeAnalogCandidates(jezero, catalog).map(({ region }) => region.id), ["atacama"]);
});

test("coordinates and Peru sectors do not gain scores from missing data", () => {
  const catalog = [jezero, world, peru];
  assert.deepEqual(computeAnalogCandidates({ ...jezero, isCustomProbe: true }, catalog), []);
  assert.equal(computeAnalogCandidates(peru, catalog)[0].scores.overall, null);
  assert.equal(computeAnalogCandidates(jezero, catalog)[0].scores.overall, null);
});
