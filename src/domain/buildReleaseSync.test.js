import assert from "node:assert/strict";
import test from "node:test";

import {
  formatReleaseNotesFromBuildCommand,
  resolveTsvClientForBuildCustomer,
} from "./buildReleaseSync.js";

test("resolveTsvClientForBuildCustomer uses map when key present", () => {
  assert.equal(
    resolveTsvClientForBuildCustomer(
      "tanger",
      { tanger: "Mall of America" },
      {}
    ),
    "Mall of America"
  );
});

test("resolveTsvClientForBuildCustomer map null skips recording", () => {
  assert.equal(
    resolveTsvClientForBuildCustomer("whitelabel", { whitelabel: null }, { whitelabel: "Alt" }),
    null
  );
});

test("resolveTsvClientForBuildCustomer falls back to slug map", () => {
  assert.equal(
    resolveTsvClientForBuildCustomer("wolfsburg", {}, { wolfsburg: "Wolfsburg" }),
    "Wolfsburg"
  );
});

test("resolveTsvClientForBuildCustomer is case-insensitive for slug keys", () => {
  assert.equal(
    resolveTsvClientForBuildCustomer("WOLFSBURG", {}, { wolfsburg: "Wolfsburg" }),
    "Wolfsburg"
  );
});

test("resolveTsvClientForBuildCustomer empty buildCustomer returns null", () => {
  assert.equal(resolveTsvClientForBuildCustomer("", { x: "y" }, {}), null);
});

test("formatReleaseNotesFromBuildCommand includes workflow and branch", () => {
  assert.equal(
    formatReleaseNotesFromBuildCommand({
      workflow: "deploy",
      branch: "master",
      env: {},
    }),
    "Slack build — workflow:deploy branch:master"
  );
});
