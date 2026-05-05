import assert from "node:assert/strict";
import test from "node:test";

import {
  BuildCommandValidationError,
  buildSlackUsage,
  formatBitriseTriggerMessage,
  parseBuildCommand,
} from "./buildCommand.js";

test("parses a full Slack build command", () => {
  const command = parseBuildCommand(
    "/flutter-build workflow:deploy | branch:master | ENV[build_env]:prod | ENV[platform_account]:tanger | ENV[build_ios]:true | ENV[build_android]:false | ENV[build_version]:8.0.18",
    { allowedCustomers: ["tanger"] }
  );

  assert.deepEqual(command, {
    workflow: "deploy",
    branch: "master",
    env: {
      build_env: "prod",
      platform_account: "tanger",
      build_ios: "true",
      build_android: "false",
      build_version: "8.0.18",
    },
  });
});

test("defaults build_ios to true when omitted", () => {
  const command = parseBuildCommand("workflow:deploy | branch:master | ENV[build_env]:qa | ENV[platform_account]:moa");

  assert.equal(command.env.build_ios, "true");
});

test("rejects invalid build environments", () => {
  assert.throws(
    () => parseBuildCommand("workflow:deploy | branch:master | ENV[build_env]:dev | ENV[platform_account]:moa"),
    BuildCommandValidationError
  );
});

test("formatBitriseTriggerMessage uses ENV build_message when set", () => {
  const command = {
    workflow: "deployFromSlack",
    branch: "development",
    env: {
      build_env: "stage",
      platform_account: "liwa",
      build_version: "0.0.12",
      build_message: "Custom title only",
    },
  };
  const msg = formatBitriseTriggerMessage(command);
  assert.ok(msg.includes("platform_account=liwa"));
  assert.ok(msg.includes("build_env=stage"));
  assert.ok(msg.includes("build_version=0.0.12"));
  assert.ok(msg.endsWith("— Custom title only"));
});

test("formatBitriseTriggerMessage omits build_message from default summary", () => {
  const command = {
    workflow: "deployFromSlack",
    branch: "main",
    env: { build_env: "prod", platform_account: "moa", build_version: "1.0.0" },
  };
  const msg = formatBitriseTriggerMessage(command);
  assert.ok(msg.startsWith("slack_flutter_build|"));
  assert.ok(msg.includes("platform_account=moa"));
  assert.ok(!msg.includes("build_message"));
});

test("buildSlackUsage includes emoji sections and optional backend time", () => {
  const base = buildSlackUsage();
  assert.ok(base.includes("📚"));
  assert.ok(base.includes("⚡"));

  const withTime = buildSlackUsage({ backendDeployedAt: "2026-05-05 12:00 UTC" });
  assert.ok(withTime.includes("⏱"));
  assert.ok(withTime.includes("2026-05-05 12:00 UTC"));
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
