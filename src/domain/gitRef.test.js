import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGitBranch } from "./gitRef.js";

test("normalizeGitBranch strips origin/ prefix", () => {
  assert.equal(
    normalizeGitBranch("origin/releases/sprint-26-14-helsinki"),
    "releases/sprint-26-14-helsinki"
  );
  assert.equal(normalizeGitBranch("ORIGIN/feature/foo"), "feature/foo");
});

test("normalizeGitBranch leaves plain branches unchanged", () => {
  assert.equal(normalizeGitBranch("development"), "development");
  assert.equal(normalizeGitBranch("releases/sprint-26-14-helsinki"), "releases/sprint-26-14-helsinki");
});

test("normalizeGitBranch trims whitespace", () => {
  assert.equal(normalizeGitBranch("  origin/main  "), "main");
});
