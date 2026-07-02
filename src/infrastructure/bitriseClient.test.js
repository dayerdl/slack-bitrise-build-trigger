import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBitriseEnvironmentsForApi,
  buildBitriseRequestBody,
  resolveBitriseWorkflowId,
} from "./bitriseClient.js";

test("buildBitriseRequestBody sets commit_message and omits build_message from environments", () => {
  const body = buildBitriseRequestBody({
    workflow: "deployFromSlack",
    branch: "development",
    env: {
      build_env: "stage",
      platform_account: "liwa",
      build_version: "0.0.12",
      build_message: "RC for Liwa smoke test",
    },
  });
  assert.ok(body.build_params.commit_message.includes("slack_flutter_build|"));
  assert.ok(body.build_params.commit_message.endsWith("— RC for Liwa smoke test"));
  const env = Object.fromEntries(
    body.build_params.environments.map((item) => [item.mapped_to, item.value])
  );
  const keys = Object.keys(env);
  assert.ok(!keys.includes("build_message"));
  assert.equal(env.slack_build_message, "RC for Liwa smoke test");
});

test("buildBitriseRequestBody commit_message defaults when build_message unset", () => {
  const body = buildBitriseRequestBody({
    workflow: "deployFromSlack",
    branch: "main",
    env: { build_env: "prod", platform_account: "moa", build_version: "1.0.0" },
  });
  assert.ok(body.build_params.commit_message.includes("slack_flutter_build|"));
});

test("resolveBitriseWorkflowId maps deploy to deployFromSlack", () => {
  assert.equal(resolveBitriseWorkflowId("deploy"), "deployFromSlack");
  assert.equal(resolveBitriseWorkflowId("deployFromSlack"), "deployFromSlack");
  assert.equal(resolveBitriseWorkflowId("other"), "other");
});

test("buildBitriseEnvironmentsForApi mirrors platform_account to build_customer", () => {
  const env = buildBitriseEnvironmentsForApi({
    workflow: "deploy",
    branch: "master",
    env: {
      build_env: "prod",
      platform_account: "tanger",
      build_version: "8.0.18",
    },
  });
  assert.equal(env.platform_account, "tanger");
  assert.equal(env.build_customer, "tanger");
});

test("buildBitriseEnvironmentsForApi mirrors build_ios and build_android to BUILD_*", () => {
  const env = buildBitriseEnvironmentsForApi({
    workflow: "deploy",
    branch: "master",
    env: {
      build_env: "stage",
      platform_account: "moa",
      build_ios: "false",
      build_android: "true",
    },
  });
  assert.equal(env.build_ios, "false");
  assert.equal(env.build_android, "true");
  assert.equal(env.BUILD_IOS, "false");
  assert.equal(env.BUILD_ANDROID, "true");
});

test("buildBitriseEnvironmentsForApi mirrors android_output_type to ANDROID_OUTPUT_TYPE", () => {
  const env = buildBitriseEnvironmentsForApi({
    workflow: "deploy",
    branch: "master",
    env: {
      build_env: "stage",
      platform_account: "moa",
      android_output_type: "aab",
    },
  });
  assert.equal(env.android_output_type, "appbundle");
  assert.equal(env.ANDROID_OUTPUT_TYPE, "appbundle");
});

test("buildBitriseEnvironmentsForApi enables dual Android artifacts for prod", () => {
  const env = buildBitriseEnvironmentsForApi({
    workflow: "deploy",
    branch: "master",
    env: {
      build_env: "prod",
      platform_account: "moa",
      build_android: "true",
      android_output_type: "aab",
    },
  });
  assert.equal(env.ANDROID_BUILD_BOTH, "true");
  assert.equal(env.android_output_type, "apk");
  assert.equal(env.ANDROID_OUTPUT_TYPE, "apk");
});

test("buildBitriseEnvironmentsForApi skips dual Android artifacts for web builds", () => {
  const env = buildBitriseEnvironmentsForApi({
    workflow: "deployWebapp",
    branch: "development",
    env: {
      build_env: "prod",
      platform_account: "macerich",
      build_platform: "web",
      build_android: "false",
      build_ios: "false",
    },
  });
  assert.equal(env.ANDROID_BUILD_BOTH, undefined);
});

test("buildBitriseEnvironmentsForApi splits 0.0.12 into app_version_*", () => {
  const env = buildBitriseEnvironmentsForApi({
    workflow: "deploy",
    branch: "development",
    env: {
      build_env: "stage",
      platform_account: "liwa",
      build_version: "0.0.12",
    },
  });
  assert.equal(env.app_version_major, "0");
  assert.equal(env.app_version_minor, "0");
  assert.equal(env.app_version_patch, "12");
});

test("buildBitriseEnvironmentsForApi leaves build_customer unset when platform_account empty", () => {
  const env = buildBitriseEnvironmentsForApi({
    workflow: "deploy",
    branch: "master",
    env: { build_env: "prod", platform_account: "  " },
  });
  assert.equal(env.build_customer, undefined);
});

test("buildBitriseRequestBody forwards Slack actor to Bitrise env and triggered_by", () => {
  const body = buildBitriseRequestBody({
    workflow: "deployFromSlack",
    branch: "development",
    env: {
      build_env: "stage",
      platform_account: "moa",
      build_version: "4.3.26",
    },
    actor: {
      userId: "U0951HFVDUJ",
      userName: "david.dayer",
    },
  });

  const env = Object.fromEntries(
    body.build_params.environments.map((item) => [item.mapped_to, item.value])
  );
  assert.equal(env.slack_triggered_by_user_id, "U0951HFVDUJ");
  assert.equal(env.slack_triggered_by_user_name, "david.dayer");
  assert.equal(body.triggered_by, "david.dayer");
});

test("buildBitriseRequestBody sends tag instead of branch when tag is set", () => {
  const body = buildBitriseRequestBody({
    workflow: "deployWebapp",
    tag: "v4.0.0-stage",
    env: {
      build_env: "stage",
      platform_account: "balharbour",
      build_version: "4.0.1",
      build_platform: "web",
    },
  });

  assert.equal(body.build_params.tag, "v4.0.0-stage");
  assert.equal(body.build_params.branch, undefined);
  const env = Object.fromEntries(
    body.build_params.environments.map((item) => [item.mapped_to, item.value])
  );
  assert.equal(env.slack_git_tag, "v4.0.0-stage");
});
