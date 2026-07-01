import assert from "node:assert/strict";
import test from "node:test";

import {
  isWebBuildPlatform,
  resolveWebHostingConfig,
  WebHostingConfigError,
} from "./clientWebHosting.js";

test("isWebBuildPlatform recognizes web", () => {
  assert.equal(isWebBuildPlatform("web"), true);
  assert.equal(isWebBuildPlatform("WEB"), true);
  assert.equal(isWebBuildPlatform("ios"), false);
});

test("resolveWebHostingConfig returns macerich stage hosting", () => {
  const hosting = resolveWebHostingConfig("macerich", "stage");
  assert.equal(hosting.web_hosting_url, "stage.webapp.school-cents.com");
  assert.equal(hosting.web_hosting_s3_bucket, "webapp-macerich-stage");
});

test("resolveWebHostingConfig returns balharbour stage hosting", () => {
  const hosting = resolveWebHostingConfig("balharbour", "stage");
  assert.equal(hosting.web_hosting_url, "stage.webapp.balharbourshops.com");
  assert.equal(hosting.web_hosting_s3_bucket, "webapp-balharbourshops-stage");
});

test("resolveWebHostingConfig rejects unknown client", () => {
  assert.throws(
    () => resolveWebHostingConfig("unknown", "stage"),
    (error) => error instanceof WebHostingConfigError
  );
});
