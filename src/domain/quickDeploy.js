import { isValidBuildEnv } from "./buildCommand.js";
import { filterRowsByClientQuery } from "./clientReleases.js";

export class QuickDeployError extends Error {
  constructor(message) {
    super(message);
    this.name = "QuickDeployError";
  }
}

/**
 * Parse leading major.minor.patch from a TSV version cell (e.g. "1.13.1 (Android)" → 1.13.1).
 * @returns {{ major: number, minor: number, patch: number } | null}
 */
export function parseLeadingSemverTriple(version) {
  const m = String(version ?? "").trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) {
    return null;
  }
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

function compareSemverDesc(a, b) {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  return a.patch - b.patch;
}

/**
 * Latest semver in `client-releases.tsv` for this account (env column ignored for the lookup),
 * then bump patch by 1. The deployment still uses `buildEnv` for Bitrise `ENV[build_env]`.
 *
 * @param {import("./clientReleases.js").ReleaseRow[]} rows
 * @param {string} platformSlug — Coniq folder slug or TSV client query
 * @param {string} buildEnv — qa | pre | stage | prod
 * @param {{ slugs: string[], slugToTsv: Record<string, string | null> } | null} catalog
 */
export function computeNextPatchFromReleases(rows, platformSlug, buildEnv, catalog) {
  if (!isValidBuildEnv(buildEnv)) {
    throw new QuickDeployError(`Invalid env "${buildEnv}". Use qa, pre, stage, or prod.`);
  }

  const matched = filterRowsByClientQuery(rows, platformSlug, catalog);

  if (matched.length === 0) {
    const tsvClientName = resolveKnownTsvClientName(platformSlug, catalog);
    if (tsvClientName) {
      return {
        tsvClientName,
        previousVersion: "0.0.0",
        nextVersion: "0.0.1",
      };
    }

    throw new QuickDeployError(
      `No releases found for "${platformSlug}". Add a row first or use the full /flutter-build command.`
    );
  }

  let best = null;
  for (const r of matched) {
    const p = parseLeadingSemverTriple(r.version);
    if (!p) {
      continue;
    }
    if (!best || compareSemverDesc(p, best.parsed) > 0) {
      best = { row: r, parsed: p };
    }
  }

  if (!best) {
    throw new QuickDeployError(
      `No major.minor.patch version found for "${platformSlug}" in the release table.`
    );
  }

  const { parsed } = best;
  const nextPatch = parsed.patch + 1;
  const previousVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  const nextVersion = `${parsed.major}.${parsed.minor}.${nextPatch}`;

  return {
    tsvClientName: best.row.client,
    previousVersion,
    nextVersion,
  };
}

function resolveKnownTsvClientName(platformSlug, catalog) {
  const slugLower = String(platformSlug ?? "").trim().toLowerCase();
  if (!slugLower || !catalog?.slugs?.length || !catalog.slugToTsv) {
    return null;
  }

  const slugExact = catalog.slugs.find((s) => s.toLowerCase() === slugLower);
  if (slugExact === undefined) {
    return null;
  }

  const mapped = catalog.slugToTsv[slugExact];
  if (mapped) {
    return mapped;
  }

  // Known folder slug listed in client_slug_to_tsv.json with null (web-only clients, etc.)
  if (Object.prototype.hasOwnProperty.call(catalog.slugToTsv, slugExact)) {
    return slugExact;
  }

  return null;
}
