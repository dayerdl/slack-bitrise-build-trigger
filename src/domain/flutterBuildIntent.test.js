import assert from "node:assert/strict";
import test from "node:test";

import { parseFlutterBuildIntent } from "./flutterBuildIntent.js";

test("list intent from first word", () => {
  assert.deepEqual(parseFlutterBuildIntent("list"), { type: "list", clientQuery: null });
  assert.deepEqual(parseFlutterBuildIntent("clients"), { type: "list", clientQuery: null });
  assert.deepEqual(parseFlutterBuildIntent("versions"), { type: "list", clientQuery: null });
});

test("list all and list with client query", () => {
  assert.deepEqual(parseFlutterBuildIntent("list all"), { type: "list", clientQuery: null });
  assert.deepEqual(parseFlutterBuildIntent("list Bergen"), {
    type: "list",
    clientQuery: "Bergen",
  });
  assert.deepEqual(parseFlutterBuildIntent("list Bergen Town Centre"), {
    type: "list",
    clientQuery: "Bergen Town Centre",
  });
  assert.deepEqual(parseFlutterBuildIntent("clients wolfsburg"), {
    type: "list",
    clientQuery: "wolfsburg",
  });
});

test("strips optional /flutter-build prefix", () => {
  assert.deepEqual(parseFlutterBuildIntent("/flutter-build list"), {
    type: "list",
    clientQuery: null,
  });
});

test("empty when no text", () => {
  assert.equal(parseFlutterBuildIntent("").type, "empty");
  assert.equal(parseFlutterBuildIntent("   ").type, "empty");
});

test("build intent for workflow line", () => {
  assert.equal(
    parseFlutterBuildIntent(
      "workflow:deploy | branch:master | ENV[build_env]:prod | ENV[platform_account]:moa"
    ).type,
    "build"
  );
});

test("help intent", () => {
  assert.equal(parseFlutterBuildIntent("help").type, "help");
});

test("quick deploy intent two words", () => {
  assert.deepEqual(parseFlutterBuildIntent("moa stage"), {
    type: "quick_deploy",
    platformSlug: "moa",
    buildEnv: "stage",
    commitMessage: null,
    buildDebug: false,
    branch: null,
  });
});

test("quick deploy accepts optional quoted message (double quotes)", () => {
  assert.deepEqual(parseFlutterBuildIntent('moa stage "this is for testing PN"'), {
    type: "quick_deploy",
    platformSlug: "moa",
    buildEnv: "stage",
    commitMessage: "this is for testing PN",
    buildDebug: false,
    branch: null,
  });
});

test("quick deploy accepts optional quoted message (single quotes)", () => {
  assert.deepEqual(parseFlutterBuildIntent("moa stage 'hello world'"), {
    type: "quick_deploy",
    platformSlug: "moa",
    buildEnv: "stage",
    commitMessage: "hello world",
    buildDebug: false,
    branch: null,
  });
});

test("quick deploy accepts debug flag", () => {
  assert.deepEqual(parseFlutterBuildIntent("moa stage --debug"), {
    type: "quick_deploy",
    platformSlug: "moa",
    buildEnv: "stage",
    commitMessage: null,
    buildDebug: true,
    branch: null,
  });
});

test("quick deploy accepts quoted message and debug flag in either order", () => {
  assert.deepEqual(parseFlutterBuildIntent('moa stage "testing PN" --debug'), {
    type: "quick_deploy",
    platformSlug: "moa",
    buildEnv: "stage",
    commitMessage: "testing PN",
    buildDebug: true,
    branch: null,
  });
  assert.deepEqual(parseFlutterBuildIntent('moa stage --debug "testing PN"'), {
    type: "quick_deploy",
    platformSlug: "moa",
    buildEnv: "stage",
    commitMessage: "testing PN",
    buildDebug: true,
    branch: null,
  });
});

test("quick deploy accepts optional branch parameter", () => {
  assert.deepEqual(parseFlutterBuildIntent("moa stage branch:feature/my-branch"), {
    type: "quick_deploy",
    platformSlug: "moa",
    buildEnv: "stage",
    commitMessage: null,
    buildDebug: false,
    branch: "feature/my-branch",
  });
});

test("quick deploy accepts branch with message and debug flag", () => {
  assert.deepEqual(parseFlutterBuildIntent('moa stage "testing PN" --debug --branch feature/my-branch'), {
    type: "quick_deploy",
    platformSlug: "moa",
    buildEnv: "stage",
    commitMessage: "testing PN",
    buildDebug: true,
    branch: "feature/my-branch",
  });
  assert.deepEqual(parseFlutterBuildIntent('moa stage --branch=feature/my-branch --debug "testing PN"'), {
    type: "quick_deploy",
    platformSlug: "moa",
    buildEnv: "stage",
    commitMessage: "testing PN",
    buildDebug: true,
    branch: "feature/my-branch",
  });
});

test("quick deploy not matched when pipe form", () => {
  assert.equal(
    parseFlutterBuildIntent("workflow:deploy | branch:main | ENV[build_env]:stage").type,
    "build"
  );
});

test("quick deploy not matched for invalid env", () => {
  assert.equal(parseFlutterBuildIntent("moa dev").type, "build");
});

test("release add and delete intent", () => {
  assert.deepEqual(parseFlutterBuildIntent("release add | client:moa | version:1"), {
    type: "release_add",
    fieldText: "| client:moa | version:1",
  });
  assert.deepEqual(parseFlutterBuildIntent("release delete | client:moa | version:1"), {
    type: "release_delete",
    fieldText: "| client:moa | version:1",
  });
  assert.deepEqual(parseFlutterBuildIntent("add release | client:x | version:2"), {
    type: "release_add",
    fieldText: "| client:x | version:2",
  });
});
