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
      "workflow:deploy | branch:master | ENV[build_env]:prod | ENV[build_customer]:moa"
    ).type,
    "build"
  );
});

test("help intent", () => {
  assert.equal(parseFlutterBuildIntent("help").type, "help");
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
