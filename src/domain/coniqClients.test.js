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

test("formatClientHelpAppendix appends app name with slash when it differs from TSV name", () => {
  const text = formatClientHelpAppendix();
  if (text.length === 0) {
    return;
  }

  assert.ok(
    text.includes("wolfsburg` — Wolfsburg / Designer Outlets Wolfsburg"),
    "expected wolfsburg to display TSV / app name"
  );
  assert.ok(
    text.includes("villaggio` — Villaggio / Summarecon Villaggio Outlets"),
    "expected villaggio to display TSV / app name"
  );
});

test("formatClientHelpAppendix does not duplicate when TSV already includes app name", () => {
  const text = formatClientHelpAppendix();
  if (text.length === 0) {
    return;
  }

  const ldoLine = text
    .split("\n")
    .find((line) => line.includes("`ldo`"));
  assert.ok(ldoLine, "expected ldo line in help appendix");
  assert.equal(ldoLine, "• `ldo` — LDO / One Wembley Park");
});

test("formatClientHelpAppendix omits slash when app name equals TSV name", () => {
  const text = formatClientHelpAppendix();
  if (text.length === 0) {
    return;
  }

  const moaLine = text
    .split("\n")
    .find((line) => line.includes("`moa`"));
  assert.ok(moaLine, "expected moa line in help appendix");
  assert.equal(moaLine, "• `moa` — Mall of America");
});
