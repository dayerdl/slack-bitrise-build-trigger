import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { formatClientHelpAppendix, loadConiqClientSlugs } from "./coniqClients.js";

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

test("formatClientHelpAppendix includes slug and name when data files exist", () => {
  const text = formatClientHelpAppendix();
  if (text.length > 0) {
    assert.ok(text.includes("moa"), "expected moa slug in help appendix");
    assert.ok(text.includes("Mall of America"), "expected TSV name for moa");
  }
});
