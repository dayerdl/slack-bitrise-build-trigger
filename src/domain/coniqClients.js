import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_CONIQ_SLUGS_PATH = join(__dirname, "../../data/coniq_client_folders.txt");
export const DEFAULT_SLUG_TO_TSV_PATH = join(__dirname, "../../data/client_slug_to_tsv.json");

export function loadConiqClientSlugs(path = DEFAULT_CONIQ_SLUGS_PATH) {
  const content = readFileSync(path, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/** @returns {Record<string, string | null>} */
export function loadSlugToTsvMap(path = DEFAULT_SLUG_TO_TSV_PATH) {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

export function buildCatalogContext() {
  const slugs = loadConiqClientSlugs();
  const slugToTsv = loadSlugToTsvMap();
  return { slugs, slugToTsv };
}
