import assert from "node:assert/strict";
import test from "node:test";

import { QuickDeployError, computeNextPatchFromReleases } from "./quickDeploy.js";

const catalog = {
  slugs: ["moa"],
  slugToTsv: { moa: "Mall of America" },
};

test("computeNextPatchFromReleases uses latest semver across stage/pre/prod ignoring env", () => {
  const rows = [
    { client: "Mall of America", version: "1.2.3", date: "2026-01-01", env: "stage", status: "", notes: "" },
    { client: "Mall of America", version: "1.2.4", date: "2026-02-01", env: "stage", status: "", notes: "" },
    { client: "Mall of America", version: "2.0.0", date: "2026-03-01", env: "prod", status: "", notes: "" },
    { client: "Mall of America", version: "1.9.9", date: "2026-02-15", env: "pre", status: "", notes: "" },
  ];
  const r = computeNextPatchFromReleases(rows, "moa", "stage", catalog);
  assert.equal(r.previousVersion, "2.0.0");
  assert.equal(r.nextVersion, "2.0.1");
  assert.equal(r.tsvClientName, "Mall of America");
});

test("computeNextPatchFromReleases parses version with suffix", () => {
  const rows = [
    { client: "Mall of America", version: "1.13.1 (Android)", date: "2026-01-01", env: "stage", status: "", notes: "" },
  ];
  const r = computeNextPatchFromReleases(rows, "moa", "stage", catalog);
  assert.equal(r.previousVersion, "1.13.1");
  assert.equal(r.nextVersion, "1.13.2");
});

test("computeNextPatchFromReleases uses prod row when deploying stage if prod has higher semver", () => {
  const rows = [
    { client: "Mall of America", version: "1.0.0", date: "2026-01-01", env: "prod", status: "", notes: "" },
  ];
  const r = computeNextPatchFromReleases(rows, "moa", "stage", catalog);
  assert.equal(r.previousVersion, "1.0.0");
  assert.equal(r.nextVersion, "1.0.1");
});

test("computeNextPatchFromReleases starts known clients without release rows at 0.0.1", () => {
  const macerichCatalog = {
    slugs: ["macerich"],
    slugToTsv: { macerich: "Macerich" },
  };

  const r = computeNextPatchFromReleases([], "macerich", "stage", macerichCatalog);
  assert.equal(r.tsvClientName, "Macerich");
  assert.equal(r.previousVersion, "0.0.0");
  assert.equal(r.nextVersion, "0.0.1");
});

test("computeNextPatchFromReleases rejects unknown clients without release rows", () => {
  assert.throws(
    () => computeNextPatchFromReleases([], "unknown", "stage", catalog),
    QuickDeployError
  );
});
