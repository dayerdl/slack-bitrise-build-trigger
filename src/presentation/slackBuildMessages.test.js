import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAcknowledgementPayload,
  buildBitriseSuccessPayload,
} from "./slackBuildMessages.js";

test("ack payload includes in_channel and blocks", () => {
  const payload = buildAcknowledgementPayload({
    command: {
      workflow: "deploy",
      branch: "main",
      env: {
        build_env: "prod",
        build_customer: "tanger",
        build_ios: "true",
        build_android: "false",
      },
    },
    userId: "U123",
    userName: "dev",
  });

  assert.equal(payload.response_type, "in_channel");
  assert.ok(Array.isArray(payload.blocks));
  assert.ok(payload.text.includes("Flutter build queued"));
  assert.ok(payload.text.includes("U123") || payload.blocks.some((b) => JSON.stringify(b).includes("U123")));
});

test("Bitrise success payload mentions TSV when releaseTsvResult ok", () => {
  const command = {
    workflow: "deploy",
    branch: "master",
    env: { build_version: "8.0.18", build_customer: "tanger", build_env: "prod" },
  };
  const payload = buildBitriseSuccessPayload({
    command,
    buildUrl: "https://example.com/build",
    buildNumber: 42,
    releaseTsvResult: { ok: true },
  });
  const ctx = payload.blocks.find((b) => b.type === "context");
  assert.ok(ctx);
  const text = JSON.stringify(ctx.elements);
  assert.ok(text.includes("client-releases.tsv"));
});
