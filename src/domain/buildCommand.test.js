import assert from "node:assert/strict";
import test from "node:test";

import { BuildCommandValidationError, parseBuildCommand } from "./buildCommand.js";

test("parses a full Slack build command", () => {
  const command = parseBuildCommand(
    "/flutter-build workflow:deploy | branch:master | ENV[build_env]:prod | ENV[build_customer]:tanger | ENV[build_ios]:true | ENV[build_android]:false | ENV[build_version]:8.0.18",
    { allowedCustomers: ["tanger"] }
  );

  assert.deepEqual(command, {
    workflow: "deploy",
    branch: "master",
    env: {
      build_env: "prod",
      build_customer: "tanger",
      build_ios: "true",
      build_android: "false",
      build_version: "8.0.18",
    },
  });
});

test("defaults build_ios to true when omitted", () => {
  const command = parseBuildCommand("workflow:deploy | branch:master | ENV[build_env]:qa | ENV[build_customer]:moa");

  assert.equal(command.env.build_ios, "true");
});

test("rejects invalid build environments", () => {
  assert.throws(
    () => parseBuildCommand("workflow:deploy | branch:master | ENV[build_env]:dev | ENV[build_customer]:moa"),
    BuildCommandValidationError
  );
});

test("rejects customers outside the configured allow list", () => {
  assert.throws(
    () =>
      parseBuildCommand("workflow:deploy | branch:master | ENV[build_env]:qa | ENV[build_customer]:unknown", {
        allowedCustomers: ["moa"],
      }),
    BuildCommandValidationError
  );
});
