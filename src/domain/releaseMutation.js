import { parseClientReleasesTsv, sortTsvReleaseRows } from "./clientReleases.js";

export class ReleaseMutationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReleaseMutationError";
  }
}

/** Parse `key:value | key:value` segments (pipes optional). */
export function parsePipeKeyValues(text) {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    throw new ReleaseMutationError("Missing fields. Use `key:value` segments separated by `|`.");
  }

  const segments = normalized
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const obj = {};

  for (const seg of segments) {
    const idx = seg.indexOf(":");
    if (idx === -1) {
      throw new ReleaseMutationError(`Invalid segment "${seg}". Expected key:value.`);
    }
    const key = seg.slice(0, idx).trim().toLowerCase();
    const value = seg.slice(idx + 1).trim();
    obj[key] = value;
  }

  return obj;
}

export function resolveClientNameForTsv(raw, slugToTsv) {
  const q = String(raw ?? "").trim();
  if (!q) {
    return "";
  }

  const lower = q.toLowerCase();
  if (slugToTsv[lower]) {
    return slugToTsv[lower];
  }

  const hit = Object.entries(slugToTsv).find(([k]) => k.toLowerCase() === lower);
  if (hit?.[1]) {
    return hit[1];
  }

  return q;
}

export function buildReleaseRowFromFields(fields, slugToTsv) {
  const clientRaw = fields.client ?? fields.c;
  const version = fields.version ?? fields.v;
  const date = fields.date ?? fields.d;
  const env = (fields.env ?? fields.e ?? "").toLowerCase().trim();
  const status = fields.status ?? fields.s ?? "";
  const notes = fields.notes ?? fields.note ?? fields.n ?? "";

  if (!clientRaw) {
    throw new ReleaseMutationError("Missing required field: `client` (folder slug or TSV name).");
  }
  if (!version) {
    throw new ReleaseMutationError("Missing required field: `version`.");
  }
  if (!date) {
    throw new ReleaseMutationError("Missing required field: `date` (ISO `YYYY-MM-DD`).");
  }
  if (!env) {
    throw new ReleaseMutationError("Missing required field: `env` (e.g. prod, stage).");
  }

  const client = resolveClientNameForTsv(clientRaw, slugToTsv);

  return {
    client,
    version,
    date,
    env,
    status,
    notes,
  };
}

export function appendReleaseToTsvContent(tsvContent, row) {
  const rows = parseClientReleasesTsv(tsvContent);
  const dup = rows.find((r) => r.client === row.client && r.version === row.version);
  if (dup) {
    throw new ReleaseMutationError(
      `Release already exists: ${row.client} ${row.version}. Delete it first or use a different version.`
    );
  }
  rows.push(row);
  return serializeClientReleasesTsv(rows);
}

export function deleteReleaseFromTsvContent(tsvContent, clientDisplay, version) {
  const rows = parseClientReleasesTsv(tsvContent);
  const next = rows.filter((r) => !(r.client === clientDisplay && r.version === version));
  if (next.length === rows.length) {
    throw new ReleaseMutationError(`No row found for client "${clientDisplay}" version "${version}".`);
  }
  return serializeClientReleasesTsv(next);
}

export function serializeClientReleasesTsv(rows) {
  const sorted = sortTsvReleaseRows(rows);
  const lines = ["client\tversion\tdate\tenv\tstatus\tnotes"];

  for (const r of sorted) {
    lines.push(
      [
        sanitizeField(r.client),
        sanitizeField(r.version),
        sanitizeField(r.date),
        sanitizeField(r.env),
        sanitizeField(r.status),
        sanitizeField(r.notes),
      ].join("\t")
    );
  }

  return `${lines.join("\n")}\n`;
}

function sanitizeField(value) {
  return String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ")
    .trim();
}
