/**
 * Map Bitrise `ENV[build_customer]` to the `client` column in `client-releases.tsv`.
 * `build_customer_to_tsv_client.json` is the source of truth; then fall back to Coniq folder slugs in `client_slug_to_tsv.json`.
 *
 * @param {string} buildCustomer
 * @param {Record<string, string | null>} buildCustomerMap
 * @param {Record<string, string | null>} slugToTsv
 * @returns {string | null} TSV client name, or null to skip recording
 */
export function resolveTsvClientForBuildCustomer(buildCustomer, buildCustomerMap, slugToTsv) {
  const k = String(buildCustomer ?? "")
    .trim()
    .toLowerCase();
  if (!k) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(buildCustomerMap, k)) {
    const v = buildCustomerMap[k];
    if (v === null || v === "") {
      return null;
    }
    return String(v);
  }

  if (slugToTsv[k]) {
    return slugToTsv[k];
  }

  const hit = Object.entries(slugToTsv).find(([key]) => key.toLowerCase() === k);
  if (hit?.[1]) {
    return hit[1];
  }

  return null;
}

export function formatReleaseNotesFromBuildCommand(command) {
  const w = command.workflow ?? "";
  const b = command.branch ?? "";
  return `Slack build — workflow:${w} branch:${b}`.trim();
}
