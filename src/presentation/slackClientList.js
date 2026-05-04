import { buildConiqCatalogSections, groupReleasesByClient } from "../domain/clientReleases.js";

const SLACK_TEXT_SAFE_LIMIT = 3500;

const CATALOG_META =
  "_Coniq `clients/` folder slugs (see `data/coniq_client_folders.txt`) · map in `data/client_slug_to_tsv.json` · releases in `data/client-releases.tsv`_";

/**
 * Ephemeral mrkdwn payload listing clients and versions (from TSV).
 * @param {{ clientQuery?: string | null, catalog?: { slugs: string[], slugToTsv: Record<string, string | null> } }} [options]
 */
export function buildClientListPayload(rows, options = {}) {
  const { clientQuery, catalog } = options;

  if (catalog?.slugs?.length && catalog.slugToTsv && !clientQuery) {
    const sections = buildConiqCatalogSections(rows, catalog.slugs, catalog.slugToTsv);
    const body = formatCatalogBody(sections);
    return wrapPayload(`*Client builds*\n${CATALOG_META}\n\n${body}`);
  }

  const { clients, byClient } = groupReleasesByClient(rows);

  const meta = clientQuery
    ? `_Filter: \`${escapeMrkdwn(clientQuery)}\` · from \`data/client-releases.tsv\`_`
    : `_From \`data/client-releases.tsv\`_`;

  const lines = [`*Client builds*`, meta, ""];

  for (const client of clients) {
    const releases = byClient.get(client) ?? [];
    lines.push(`*${escapeMrkdwn(client)}*`);

    for (const r of releases) {
      lines.push(formatReleaseLine(r));
    }

    lines.push("");
  }

  return wrapPayload(lines.join("\n").trim());
}

function formatCatalogBody(sections) {
  const lines = [];

  for (const sec of sections) {
    if (sec.kind === "coniq") {
      lines.push(`*${escapeMrkdwn(sec.slug)}*`);
      if (sec.tsvName) {
        lines.push(`_${escapeMrkdwn(sec.tsvName)}_`);
      } else {
        lines.push(
          "_No TSV name mapped — set a value in `data/client_slug_to_tsv.json` when this client has release rows._"
        );
      }

      if (sec.rows.length === 0 && sec.tsvName) {
        lines.push("_No rows in `client-releases.tsv` for this client._");
      }

      for (const r of sec.rows) {
        lines.push(formatReleaseLine(r));
      }
    } else {
      lines.push(`*${escapeMrkdwn(sec.tsvName)}*`);
      lines.push("_In TSV only — not linked to a Coniq `clients/` folder slug._");
      for (const r of sec.rows) {
        lines.push(formatReleaseLine(r));
      }
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}

function formatReleaseLine(r) {
  const parts = [
    r.version ? `\`${escapeMrkdwn(r.version)}\`` : null,
    r.date || null,
    r.env || null,
    r.status || null,
  ].filter(Boolean);
  return `• ${parts.join(" · ")}`;
}

function wrapPayload(text) {
  if (text.length > SLACK_TEXT_SAFE_LIMIT) {
    return {
      response_type: "ephemeral",
      text:
        text.slice(0, SLACK_TEXT_SAFE_LIMIT - 120).trim() +
        "\n\n_(Truncated for Slack length. See `data/client-releases.tsv`.)_",
    };
  }

  return {
    response_type: "ephemeral",
    text,
  };
}

function escapeMrkdwn(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
