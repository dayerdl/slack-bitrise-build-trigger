import assert from "node:assert/strict";
import test from "node:test";

import {
  BuildCommandValidationError,
  buildSlackUsage,
  formatAndroidOutputTypeLabel,
  formatBitriseTriggerMessage,
  formatCommandSummary,
  normalizeAndroidOutputType,
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
    tag: null,
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

test("accepts android_output_type appbundle", () => {
  const command = parseBuildCommand(
    "workflow:deploy | branch:master | ENV[build_env]:qa | ENV[platform_account]:moa | ENV[android_output_type]:appbundle"
  );

  assert.equal(command.env.android_output_type, "appbundle");
});

test("accepts android_output_type aab alias", () => {
  const command = parseBuildCommand(
    "workflow:deploy | branch:master | ENV[build_env]:qa | ENV[platform_account]:moa | ENV[android_output_type]:aab"
  );

  assert.equal(command.env.android_output_type, "appbundle");
});

test("normalizeAndroidOutputType maps aab to appbundle", () => {
  assert.equal(normalizeAndroidOutputType("aab"), "appbundle");
  assert.equal(normalizeAndroidOutputType("apk"), "apk");
});

test("formatAndroidOutputTypeLabel shows apk+aab for prod android builds", () => {
  assert.equal(
    formatAndroidOutputTypeLabel({
      build_env: "prod",
      build_android: "true",
      android_output_type: "apk",
    }),
    "apk+aab"
  );
  assert.equal(
    formatAndroidOutputTypeLabel({
      build_env: "stage",
      build_android: "true",
      android_output_type: "aab",
    }),
    "appbundle"
  );
});

test("formatCommandSummary shows apk+aab for prod android builds", () => {
  const summary = formatCommandSummary({
    workflow: "deployFromSlack",
    branch: "development",
    env: {
      build_env: "prod",
      platform_account: "moa",
      build_ios: "true",
      build_android: "true",
      android_output_type: "apk",
      build_version: "4.3.368",
    },
  });
  assert.ok(summary.includes("android_output_type=apk+aab"));
});

test("rejects invalid android_output_type", () => {
  assert.throws(
    () =>
      parseBuildCommand(
        "workflow:deploy | branch:master | ENV[build_env]:qa | ENV[platform_account]:moa | ENV[android_output_type]:zip"
      ),
    BuildCommandValidationError
  );
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

test("formatBitriseTriggerMessage includes Slack actor when provided", () => {
  const command = {
    workflow: "deployFromSlack",
    branch: "main",
    env: { build_env: "prod", platform_account: "moa", build_version: "1.0.0" },
    actor: { userId: "U123", userName: "dev" },
  };
  const msg = formatBitriseTriggerMessage(command);
  assert.ok(msg.includes("slack_user_name=dev"));
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

test("parses web deploy command with hosting env vars", () => {
  const command = parseBuildCommand(
    "workflow:deployWebapp | branch:development | ENV[build_env]:stage | ENV[platform_account]:macerich | platform:web | ENV[build_version]:1.0.0",
    { allowedCustomers: ["macerich"] }
  );

  assert.equal(command.workflow, "deployWebapp");
  assert.equal(command.env.build_platform, "web");
  assert.equal(command.env.build_ios, "false");
  assert.equal(command.env.build_android, "false");
  assert.equal(command.env.aws_bucket_name, "webapp-macerich-stage");
  assert.equal(command.env.web_hosting_url, "stage.webapp.school-cents.com");
});

test("infers deployWebapp workflow when platform:web without explicit workflow", () => {
  const command = parseBuildCommand(
    "branch:development | ENV[build_env]:stage | ENV[platform_account]:balharbour | platform:web | ENV[build_version]:4.0.1"
  );

  assert.equal(command.workflow, "deployWebapp");
  assert.equal(command.env.aws_bucket_name, "webapp-balharbourshops-stage");
});

test("parses tag instead of branch in full command", () => {
  const command = parseBuildCommand(
    "workflow:deploy | tag:v4.0.0-stage | ENV[build_env]:stage | ENV[platform_account]:moa | ENV[build_version]:4.0.1"
  );

  assert.equal(command.tag, "v4.0.0-stage");
  assert.equal(command.branch, null);
  assert.ok(formatCommandSummary(command).includes("tag=v4.0.0-stage"));
});

test("strips origin/ prefix from branch in full command", () => {
  const command = parseBuildCommand(
    "workflow:deploy | branch:origin/releases/sprint-26-14-helsinki | ENV[build_env]:stage | ENV[platform_account]:helsinki | ENV[build_version]:1.0.0"
  );

  assert.equal(command.branch, "releases/sprint-26-14-helsinki");
});

test("rejects branch and tag together", () => {
  assert.throws(
    () =>
      parseBuildCommand(
        "workflow:deploy | branch:main | tag:v1.0.0 | ENV[build_env]:stage | ENV[platform_account]:moa"
      ),
    /branch: or tag:/
  );
});
