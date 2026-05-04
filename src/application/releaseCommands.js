import {
  appendReleaseToTsvContent,
  buildReleaseRowFromFields,
  deleteReleaseFromTsvContent,
  parsePipeKeyValues,
  ReleaseMutationError,
} from "../domain/releaseMutation.js";
import { createReleaseDataStore } from "../infrastructure/releaseDataStore.js";

export { ReleaseMutationError } from "../domain/releaseMutation.js";

function ensureCanPersistReleases() {
  if (process.env.VERCEL === "1" && !String(process.env.GITHUB_TOKEN ?? "").trim()) {
    throw new ReleaseMutationError(
      "On Vercel, set `GITHUB_TOKEN` and `GITHUB_REPOSITORY` to add or delete releases (contents:write on the repo). See `.env.example`."
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
