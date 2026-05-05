import assert from "node:assert/strict";
import test from "node:test";

import { signQuickDeployToken, verifyQuickDeployToken } from "./quickDeployConfirmToken.js";

test("sign and verify quick deploy token round-trip", () => {
  const secret = "test-secret";
  const payload = {
    t: Date.now(),
    platform_account: "moa",
    build_env: "stage",
    build_version: "1.2.5",
    previous_version: "1.2.4",
    branch: "development",
    workflow: "deployFromSlack",
  };
  const token = signQuickDeployToken(payload, secret);
  const out = verifyQuickDeployToken(token, secret);
  assert.equal(out.platform_account, "moa");
  assert.equal(out.build_version, "1.2.5");
});

test("verifyQuickDeployToken rejects tampered token", () => {
  const token = signQuickDeployToken({ t: Date.now(), platform_account: "moa" }, "secret");
  const tampered = token.slice(0, -4) + "xxxx";
  assert.equal(verifyQuickDeployToken(tampered, "secret"), null);
});
