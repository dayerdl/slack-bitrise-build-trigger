import { groupReleasesByClient } from "../domain/clientReleases.js";

const SLACK_TEXT_SAFE_LIMIT = 3500;

/**
 * Ephemeral mrkdwn payload listing clients and all known versions (from TSV).
 */
export function buildClientListPayload(rows) {
  const { clients, byClient } = groupReleasesByClient(rows);

  const lines = ["*Client builds*", "_From `data/client-releases.tsv`_\n"];

  for (const client of clients) {
    const releases = byClient.get(client) ?? [];
    lines.push(`*${escapeMrkdwn(client)}*`);

    for (const r of releases) {
      const parts = [
        r.version ? `\`${escapeMrkdwn(r.version)}\`` : null,
        r.date || null,
        r.env || null,
        r.status || null,
      ].filter(Boolean);
      lines.push(`• ${parts.join(" · ")}`);
    }

    lines.push("");
  }

  let text = lines.join("\n").trim();

  if (text.length > SLACK_TEXT_SAFE_LIMIT) {
    text =
      text.slice(0, SLACK_TEXT_SAFE_LIMIT - 120).trim() +
      "\n\n_(Truncated for Slack length. See full table in repo `data/client-releases.tsv`.)_";
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
