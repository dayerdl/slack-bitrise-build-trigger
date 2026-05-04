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
      platform_account: "tanger",
      build_ios: "true",
      build_android: "false",
      build_version: "8.0.18",
    },
  });
});

test("accepts platform_account directly", () => {
  const command = parseBuildCommand(
    "workflow:deploy | branch:master | ENV[build_env]:prod | ENV[platform_account]:tanger",
    { allowedCustomers: ["tanger"] }
  );

  assert.equal(command.env.platform_account, "tanger");
  assert.equal(command.env.build_customer, "tanger");
});

test("defaults build_ios to true when omitted", () => {
  const command = parseBuildCommand("workflow:deploy | branch:master | ENV[build_env]:qa | ENV[platform_account]:moa");

  assert.equal(command.env.build_ios, "true");
});

test("defaults build_android to false when omitted", () => {
  const command = parseBuildCommand("workflow:deploy | branch:master | ENV[build_env]:qa | ENV[platform_account]:moa");

  assert.equal(command.env.build_android, "false");
});

test("rejects invalid build environments", () => {
  assert.throws(
    () => parseBuildCommand("workflow:deploy | branch:master | ENV[build_env]:dev | ENV[platform_account]:moa"),
    BuildCommandValidationError
  );
});

test("rejects invalid build versions", () => {
  assert.throws(
    () =>
      parseBuildCommand(
        "workflow:deploy | branch:master | ENV[build_env]:stage | ENV[build_customer]:moa | ENV[build_version]:8.0"
      ),
    BuildCommandValidationError
  );
});

test("rejects customers outside the configured allow list", () => {
  assert.throws(
    () =>
      parseBuildCommand("workflow:deploy | branch:master | ENV[build_env]:qa | ENV[platform_account]:unknown", {
        allowedCustomers: ["moa"],
      }),
    BuildCommandValidationError
  );
});
