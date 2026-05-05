import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Default path to bundled release table (relative to this module). */
export const DEFAULT_RELEASES_TSV_PATH = join(__dirname, "../../data/client-releases.tsv");

export function loadClientReleaseRows(tsvPath = DEFAULT_RELEASES_TSV_PATH) {
  const content = readFileSync(tsvPath, "utf8");
  return parseClientReleasesTsv(content);
}

export function parseClientReleasesTsv(content) {
  const lines = String(content ?? "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.toLowerCase().startsWith("client\t")) {
      continue;
    }

    const parts = line.split("\t");
    if (parts.length < 5) {
      continue;
    }

    const client = parts[0]?.trim() ?? "";
    const version = parts[1]?.trim() ?? "";
    const date = parts[2]?.trim() ?? "";
    const env = parts[3]?.trim() ?? "";
    const status = parts[4]?.trim() ?? "";
    const notes = parts.slice(5).join("\t").trim();

    if (!client || !version) {
      continue;
    }

    rows.push({ client, version, date, env, status, notes });
  }

  return rows;
}

/**
 * Group rows by client; sort clients A–Z; within each client sort by date descending.
 */
export function groupReleasesByClient(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.client)) {
      map.set(row.client, []);
    }
    map.get(row.client).push(row);
  }

  const clients = [...map.keys()].sort((a, b) => a.localeCompare(b, "en"));

  for (const client of clients) {
    const list = map.get(client);
    list.sort((a, b) => compareIsoDateDesc(a.date, b.date));
  }

  return { clients, byClient: map };
}

/**
 * Filter release rows by client name. When `catalog` is passed, also matches
 * Coniq `clients/` folder slugs via `client_slug_to_tsv.json`.
 *
 * @param {{ slugs: string[], slugToTsv: Record<string, string | null> }} [catalog]
 */
export function filterRowsByClientQuery(rows, query, catalog = null) {
  const q = String(query ?? "").trim();
  if (!q) {
    return rows;
  }

  const qLower = q.toLowerCase();

  if (catalog?.slugs?.length && catalog.slugToTsv) {
    const { slugs, slugToTsv } = catalog;

    const slugExact = slugs.find((s) => s.toLowerCase() === qLower);
    if (slugExact !== undefined) {
      const name = slugToTsv[slugExact];
      if (name) {
        return rows.filter((r) => r.client === name);
      }
      return [];
    }

    const slugPartials = slugs.filter((s) => s.includes(qLower));
    if (slugPartials.length > 0) {
      const names = slugPartials.map((s) => slugToTsv[s]).filter(Boolean);
      if (names.length > 0) {
        return rows.filter((r) => names.includes(r.client));
      }
      return [];
    }

    const matchedValues = Object.values(slugToTsv).filter(
      (v) => v && v.toLowerCase().includes(qLower)
    );
    if (matchedValues.length > 0) {
      return rows.filter((r) => matchedValues.includes(r.client));
    }
  }

  const exact = rows.filter((r) => r.client.toLowerCase() === qLower);
  if (exact.length > 0) {
    return exact;
  }

  return rows.filter((r) => r.client.toLowerCase().includes(qLower));
}

/**
 * Order: Coniq folder slugs (sorted), then TSV-only clients not mapped from any slug.
 */
export function buildConiqCatalogSections(rows, slugs, slugToTsv) {
  const { byClient } = groupReleasesByClient(rows);
  const mappedNames = new Set(
    Object.values(slugToTsv).filter((v) => typeof v === "string" && v.length > 0)
  );

  const slugOrder = [...slugs].sort((a, b) => a.localeCompare(b, "en"));
  const sections = [];

  for (const slug of slugOrder) {
    const tsvName = slugToTsv[slug];
    const releaseRows = tsvName ? byClient.get(tsvName) ?? [] : [];
    sections.push({ kind: "coniq", slug, tsvName: tsvName ?? null, rows: releaseRows });
  }

  const orphanNames = [...new Set(rows.map((r) => r.client))]
    .filter((c) => !mappedNames.has(c))
    .sort((a, b) => a.localeCompare(b, "en"));

  for (const name of orphanNames) {
    sections.push({
      kind: "orphan",
      slug: null,
      tsvName: name,
      rows: byClient.get(name) ?? [],
    });
  }

  return sections;
}

/**
 * Sort rows for `client-releases.tsv`: client name (A–Z), then date (newest first),
 * then version (descending, numeric-aware when possible).
 */
export function sortTsvReleaseRows(rows) {
  return [...rows].sort((a, b) => {
    const byClient = a.client.localeCompare(b.client, "en", { sensitivity: "base" });
    if (byClient !== 0) {
      return byClient;
    }

    const byDate = compareIsoDateDesc(a.date, b.date);
    if (byDate !== 0) {
      return byDate;
    }

    return String(b.version).localeCompare(String(a.version), "en", { numeric: true, sensitivity: "base" });
  });
}

function compareIsoDateDesc(a, b) {
  if (!a && !b) {
    return 0;
  }
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  return b.localeCompare(a);
}
