import { persistReleaseRowAfterBitriseTrigger } from "../src/application/persistReleaseAfterBuild.js";
import { parseBitriseCommitMessageMetadata } from "../src/domain/bitriseCommitMessage.js";
import { getBitriseBuild } from "../src/infrastructure/bitriseBuilds.js";

export async function GET() {
  return Response.json({ ok: false, message: "Use POST." }, { status: 405 });
}

export async function POST(request) {
  try {
    const expected = String(process.env.BITRISE_WEBHOOK_SECRET ?? "").trim();
    if (expected) {
      const got = String(request.headers.get("x-bitrise-webhook-secret") ?? "").trim();
      if (!got || got !== expected) {
        return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
      }
    }

    const payload = await request.json();
    const buildSlug = payload?.build_slug;
    const appSlug = payload?.app_slug || process.env.BITRISE_APP_SLUG;
    if (!buildSlug) {
      return Response.json({ ok: false, message: "Missing build_slug" }, { status: 400 });
    }

    const build = await getBitriseBuild({
      appSlug,
      apiToken: process.env.BITRISE_API_TOKEN,
      buildSlug,
    });

    // status: 1 successful, 4 aborted with success
    if (build?.status !== 1 && build?.status !== 4) {
      return Response.json({ ok: true, skipped: true, reason: "not_success", status: build?.status });
    }

    const meta = parseBitriseCommitMessageMetadata(build?.commit_message);
    if (!meta) {
      return Response.json({ ok: true, skipped: true, reason: "no_metadata" });
    }

    const command = {
      workflow: build?.triggered_workflow || "deployFromSlack",
      branch: build?.branch || String(build?.original_build_params?.branch ?? "").trim() || "development",
      env: {
        platform_account: meta.platform_account,
        build_env: meta.build_env,
        build_version: meta.build_version,
      },
    };

    const result = await persistReleaseRowAfterBitriseTrigger(command);
    return Response.json({ ok: true, persisted: result });
  } catch (error) {
    console.error("bitrise webhook failed", error);
    return Response.json({ ok: false, message: error.message }, { status: 500 });
  }
}

