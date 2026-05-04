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
 * Filter release rows by client name. Exact case-insensitive match wins; otherwise
 * any client whose name includes the query (case-insensitive).
 */
export function filterRowsByClientQuery(rows, query) {
  const q = String(query ?? "").trim();
  if (!q) {
    return rows;
  }

  const qLower = q.toLowerCase();
  const exact = rows.filter((r) => r.client.toLowerCase() === qLower);
  if (exact.length > 0) {
    return exact;
  }

  return rows.filter((r) => r.client.toLowerCase().includes(qLower));
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
