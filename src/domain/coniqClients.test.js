import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadConiqClientSlugs } from "./coniqClients.js";

test("loadConiqClientSlugs skips comments and blanks", () => {
  const dir = mkdtempSync(join(tmpdir(), "coniq-slugs-"));
  const file = join(dir, "f.txt");
  writeFileSync(file, "# c\n\nalpha\n beta \n", "utf8");
  try {
    const slugs = loadConiqClientSlugs(file);
    assert.deepEqual(slugs, ["alpha", "beta"]);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
