#!/usr/bin/env node
/**
 * Regenerate data/coniq_client_folders.txt from a local coniq_csa checkout.
 *
 * Usage:
 *   node scripts/sync-coniq-client-folders.mjs /Users/you/coniq_csa/clients
 */

import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const outFile = join(repoRoot, "data/coniq_client_folders.txt");

const clientsRoot = process.argv[2] ?? join(repoRoot, "../coniq_csa/clients");

const dirs = readdirSync(clientsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "default" && !d.name.startsWith("."))
  .map((d) => d.name)
  .sort((a, b) => a.localeCompare(b, "en"));

const header = `# Synced from ${clientsRoot} (exclude default)\n`;

writeFileSync(outFile, `${header}${dirs.join("\n")}\n`, "utf8");
console.log(`Wrote ${dirs.length} slugs -> ${outFile}`);
