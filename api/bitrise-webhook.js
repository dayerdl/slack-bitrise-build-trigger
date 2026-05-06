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

    console.info("[bitrise-webhook] received", {
      build_slug: buildSlug,
      app_slug: appSlug ? "(provided)" : "(missing)",
    });

    const build = await getBitriseBuild({
      appSlug,
      apiToken: process.env.BITRISE_API_TOKEN,
      buildSlug,
    });

    // Intentionally ignore `build.status` so this endpoint can run from a workflow step
    // even when Bitrise's build status is still "in progress" in the API.

    const meta = parseBitriseCommitMessageMetadata(build?.commit_message);
    if (!meta) {
      console.warn("[bitrise-webhook] rejected (no_metadata)", {
        build_slug: buildSlug,
        triggered_workflow: build?.triggered_workflow,
        has_commit_message: Boolean(String(build?.commit_message ?? "").trim()),
        commit_message_head: String(build?.commit_message ?? "").trim().slice(0, 120),
      });
      return Response.json(
        {
          ok: false,
          reason: "no_metadata",
          message:
            "Build commit_message did not include slack metadata. This webhook only persists releases for builds triggered by /flutter-build (commit_message starts with 'slack_flutter_build|').",
        },
        { status: 422 }
      );
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
    if (!result?.ok) {
      console.warn("[bitrise-webhook] persist failed", {
        build_slug: buildSlug,
        reason: result?.reason,
        platform_account: meta.platform_account,
        build_env: meta.build_env,
        build_version: meta.build_version,
      });
      return Response.json(
        { ok: false, reason: result?.reason ?? "persist_failed", persisted: result },
        { status: 422 }
      );
    }

    console.info("[bitrise-webhook] persisted", {
      build_slug: buildSlug,
      platform_account: meta.platform_account,
      build_env: meta.build_env,
      build_version: meta.build_version,
    });
    return Response.json({ ok: true, persisted: result }, { status: 200 });
  } catch (error) {
    console.error("bitrise webhook failed", error);
    return Response.json({ ok: false, message: error.message }, { status: 500 });
  }
}

