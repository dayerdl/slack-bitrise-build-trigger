import {
  appendReleaseToTsvContent,
  buildReleaseRowFromFields,
  deleteReleaseFromTsvContent,
  parsePipeKeyValues,
  ReleaseMutationError,
  resolveClientNameForTsv,
} from "../domain/releaseMutation.js";
import { createReleaseDataStore } from "../infrastructure/releaseDataStore.js";

export { ReleaseMutationError } from "../domain/releaseMutation.js";

function ensureCanPersistReleases() {
  if (process.env.VERCEL !== "1") {
    return;
  }
  const token = String(process.env.GITHUB_TOKEN ?? "").trim();
  const repo = String(process.env.GITHUB_REPOSITORY ?? "").trim();
  if (!token || !repo) {
    throw new ReleaseMutationError(
      "On Vercel the filesystem is read-only. Set both `GITHUB_TOKEN` (contents:write on the repo) and `GITHUB_REPOSITORY` (e.g. `dayerdl/slack-bitrise-build-trigger`), then redeploy. See `.env.example`."
    );
  }
}

export async function executeReleaseAdd(fieldText, slugToTsv) {
  ensureCanPersistReleases();
  const fields = parsePipeKeyValues(fieldText);
  const row = buildReleaseRowFromFields(fields, slugToTsv);
  const store = createReleaseDataStore();
  const tsv = await store.loadTsv();
  const next = appendReleaseToTsvContent(tsv, row);
  await store.saveTsv(
    next,
    `chore(releases): add ${row.client} ${row.version} [slack]`
  );
  return `Added release \`${row.version}\` for *${row.client}* (${row.date}, ${row.env}).`;
}

export async function executeReleaseDelete(fieldText, slugToTsv) {
  ensureCanPersistReleases();
  const fields = parsePipeKeyValues(fieldText);
  const clientRaw = fields.client ?? fields.c;
  const version = fields.version ?? fields.v;

  if (!clientRaw) {
    throw new ReleaseMutationError("Missing `client` (folder slug or TSV name).");
  }
  if (!version) {
    throw new ReleaseMutationError("Missing `version`.");
  }

  const client = resolveClientNameForTsv(clientRaw, slugToTsv);
  const store = createReleaseDataStore();
  const tsv = await store.loadTsv();
  const next = deleteReleaseFromTsvContent(tsv, client, version);
  await store.saveTsv(
    next,
    `chore(releases): remove ${client} ${version} [slack]`
  );
  return `Deleted release \`${version}\` for *${client}*.`;
}
