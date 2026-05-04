import assert from "node:assert/strict";
import test from "node:test";

import { parseFlutterBuildIntent } from "./flutterBuildIntent.js";

test("list intent from first word", () => {
  assert.equal(parseFlutterBuildIntent("list").type, "list");
  assert.equal(parseFlutterBuildIntent("clients").type, "list");
  assert.equal(parseFlutterBuildIntent("versions").type, "list");
});

test("strips optional /flutter-build prefix", () => {
  assert.equal(parseFlutterBuildIntent("/flutter-build list").type, "list");
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
