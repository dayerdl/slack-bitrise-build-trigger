import { loadBuildCustomerToTsvMap, loadSlugToTsvMap } from "../domain/coniqClients.js";
import {
  formatReleaseNotesFromBuildCommand,
  resolveTsvClientForBuildCustomer,
} from "../domain/buildReleaseSync.js";
import { appendReleaseToTsvContent, ReleaseMutationError } from "../domain/releaseMutation.js";
import { createReleaseDataStore } from "../infrastructure/releaseDataStore.js";

/**
 * After a successful Bitrise trigger, append a row to `client-releases.tsv` when
 * `ENV[build_version]` is set and `ENV[platform_account]` maps to a TSV client.
 *
 * @returns {Promise<{ ok: true } | { ok: false; reason: string }>}
 */
export async function persistReleaseRowAfterBitriseTrigger(command) {
  if (String(process.env.RECORD_RELEASE_TSV_ON_BUILD ?? "true").toLowerCase() === "false") {
    return { ok: false, reason: "disabled" };
  }

  const version = String(command.env?.build_version ?? "").trim();
  if (!version) {
    return { ok: false, reason: "no_version" };
  }

  if (process.env.VERCEL === "1") {
    const token = String(process.env.GITHUB_TOKEN ?? "").trim();
    const repo = String(process.env.GITHUB_REPOSITORY ?? "").trim();
    if (!token || !repo) {
      return { ok: false, reason: "no_github" };
    }
  }

  const buildCustomerMap = loadBuildCustomerToTsvMap();
  const slugToTsv = loadSlugToTsvMap();
  const client = resolveTsvClientForBuildCustomer(
    command.env?.platform_account,
    buildCustomerMap,
    slugToTsv
  );

  if (!client) {
    return { ok: false, reason: "no_mapping" };
  }

  const row = {
    client,
    version,
    date: new Date().toISOString().slice(0, 10),
    env: String(command.env?.build_env ?? "").trim() || "—",
    status: "bitrise",
    notes: formatReleaseNotesFromBuildCommand(command),
  };

  const store = createReleaseDataStore();
  const tsv = await store.loadTsv();

  try {
    const next = appendReleaseToTsvContent(tsv, row);
    await store.saveTsv(
      next,
      `chore(releases): ${client} ${version} from Bitrise trigger [slack]`
    );
    return { ok: true };
  } catch (error) {
    if (error instanceof ReleaseMutationError && /already exists/i.test(error.message)) {
      return { ok: false, reason: "duplicate" };
    }
    throw error;
  }
}
