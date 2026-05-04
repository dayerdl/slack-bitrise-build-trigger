import assert from "node:assert/strict";
import test from "node:test";

import { buildBitriseEnvironmentsForApi } from "./bitriseClient.js";

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

test("buildBitriseEnvironmentsForApi maps Slack aliases to Flutter workflow envs", () => {
  const env = buildBitriseEnvironmentsForApi({
    workflow: "deploy",
    branch: "development",
    env: {
      build_env: "stage",
      build_customer: "moa",
      build_ios: "true",
      build_android: "false",
      build_version: "8.0.18",
    },
  });

  assert.equal(env.platform_account, "moa");
  assert.equal(env.build_customer, "moa");
  assert.equal(env.BUILD_IOS, "true");
  assert.equal(env.BUILD_ANDROID, "false");
  assert.equal(env.app_version_major, "8");
  assert.equal(env.app_version_minor, "0");
  assert.equal(env.app_version_patch, "18");
});

test("buildBitriseEnvironmentsForApi includes default platform flags", () => {
  const env = buildBitriseEnvironmentsForApi({
    workflow: "deploy",
    branch: "development",
    env: {
      build_env: "stage",
      platform_account: "moa",
      build_ios: "true",
      build_android: "false",
    },
  });

  assert.equal(env.BUILD_IOS, "true");
  assert.equal(env.BUILD_ANDROID, "false");
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
