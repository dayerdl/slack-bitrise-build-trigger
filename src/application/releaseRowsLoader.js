import { parseClientReleasesTsv, loadClientReleaseRows } from "../domain/clientReleases.js";
import { createReleaseDataStore } from "../infrastructure/releaseDataStore.js";

/**
 * Prefer GitHub-backed TSV when configured; otherwise local bundled file.
 */
export async function loadReleaseRowsForSlack() {
  try {
    const store = createReleaseDataStore();
    const tsv = await store.loadTsv();
    return parseClientReleasesTsv(tsv);
  } catch {
    return loadClientReleaseRows();
  }
}
