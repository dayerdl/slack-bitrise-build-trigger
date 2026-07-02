import assert from "node:assert/strict";
import test from "node:test";

import { buildCommandFromVerifiedQuickDeploy } from "./quickDeployFromToken.js";

test("buildCommandFromVerifiedQuickDeploy builds mobile deploy by default", () => {
  const command = buildCommandFromVerifiedQuickDeploy({
    workflow: "deployFromSlack",
    branch: "development",
    platform_account: "moa",
    build_env: "stage",
    build_version: "1.2.3",
  });

  assert.equal(command.workflow, "deployFromSlack");
  assert.equal(command.env.build_ios, "true");
  assert.equal(command.env.build_android, "true");
});

test("buildCommandFromVerifiedQuickDeploy builds web deploy workflow", () => {
  const command = buildCommandFromVerifiedQuickDeploy({
    workflow: "deployWebapp",
    branch: "development",
    platform_account: "macerich",
    build_env: "stage",
    build_version: "0.0.2",
    build_platform: "web",
    aws_bucket_name: "webapp-macerich-stage",
    web_hosting_url: "stage.webapp.school-cents.com",
  });

  assert.equal(command.workflow, "deployWebapp");
  assert.equal(command.env.build_platform, "web");
  assert.equal(command.env.build_ios, "false");
  assert.equal(command.env.build_android, "false");
  assert.equal(command.env.aws_bucket_name, "webapp-macerich-stage");
  assert.equal(command.env.web_hosting_url, "stage.webapp.school-cents.com");
});

test("buildCommandFromVerifiedQuickDeploy uses tag instead of branch", () => {
  const command = buildCommandFromVerifiedQuickDeploy({
    workflow: "deployWebapp",
    tag: "v4.0.0-stage",
    platform_account: "balharbour",
    build_env: "stage",
    build_version: "4.0.1",
    build_platform: "web",
  });

  assert.equal(command.tag, "v4.0.0-stage");
  assert.equal(command.branch, null);
});
