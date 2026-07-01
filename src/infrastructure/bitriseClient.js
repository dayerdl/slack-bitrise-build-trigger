import { formatBitriseTriggerMessage, normalizeAndroidOutputType } from "../domain/buildCommand.js";
import { isWebBuildPlatform } from "../domain/clientWebHosting.js";

const BITRISE_API_BASE_URL = "https://api.bitrise.io/v0.1";

export class BitriseClientError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "BitriseClientError";
    this.details = details;
  }
}

export async function triggerBitriseBuild({ appSlug, apiToken, command, abortSignal }) {
  if (!appSlug) {
    throw new BitriseClientError("Missing BITRISE_APP_SLUG.");
  }

  if (!apiToken) {
    throw new BitriseClientError("Missing BITRISE_API_TOKEN.");
  }

  const response = await fetch(`${BITRISE_API_BASE_URL}/apps/${appSlug}/builds`, {
    method: "POST",
    signal: abortSignal,
    headers: {
      Authorization: apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildBitriseRequestBody(command)),
  });

  const responseBody = await readJsonSafely(response);

  if (!response.ok) {
    throw new BitriseClientError("Bitrise rejected the build trigger request.", {
      status: response.status,
      responseBody,
    });
  }

  return {
    buildSlug: responseBody?.build_slug,
    buildNumber: responseBody?.build_number,
    buildUrl: responseBody?.build_url,
    raw: responseBody,
  };
}

/**
 * Bitrise env vars for the API: mirrors `platform_account` into `build_customer`
 * so older workflows that still read `build_customer` keep working.
 */
export function buildBitriseEnvironmentsForApi(command) {
  const env = { ...command.env };
  const buildMessage = String(env.build_message ?? "").trim();

  // `ENV[build_message]` is used to build Bitrise `commit_message`, but it is not a build env var.
  if (Object.prototype.hasOwnProperty.call(env, "build_message")) {
    if (buildMessage && !env.slack_build_message) {
      env.slack_build_message = buildMessage;
    }
    delete env.build_message;
  }

  const actorUserId = String(command.actor?.userId ?? "").trim();
  const actorUserName = String(command.actor?.userName ?? "").trim();
  if (actorUserId && !env.slack_triggered_by_user_id) {
    env.slack_triggered_by_user_id = actorUserId;
  }
  if (actorUserName && !env.slack_triggered_by_user_name) {
    env.slack_triggered_by_user_name = actorUserName;
  }

  const account = String(env.platform_account ?? "").trim();
  if (account) {
    env.platform_account = account;
    env.build_customer = account;
  }

  if (env.build_ios) {
    env.BUILD_IOS = env.build_ios;
  }
  if (env.build_android) {
    env.BUILD_ANDROID = env.build_android;
  }

  if (env.android_output_type) {
    env.android_output_type = normalizeAndroidOutputType(env.android_output_type);
    env.ANDROID_OUTPUT_TYPE = env.android_output_type;
  }

  const buildEnv = String(env.build_env ?? "").trim().toLowerCase();
  const buildAndroidEnabled = String(env.build_android ?? "true").trim().toLowerCase() !== "false";
  const isWebBuild = isWebBuildPlatform(env.build_platform);
  if (buildEnv === "prod" && buildAndroidEnabled && !isWebBuild) {
    env.ANDROID_BUILD_BOTH = "true";
    env.android_output_type = "apk";
    env.ANDROID_OUTPUT_TYPE = "apk";
    env.android_output_type_display = "apk+aab";
  }

  // Derive `app_version_*` from `build_version` when not already set.
  const buildVersion = String(env.build_version ?? "").trim();
  if (buildVersion && !env.app_version_major && !env.app_version_minor && !env.app_version_patch) {
    const m = buildVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (m) {
      env.app_version_major = m[1];
      env.app_version_minor = m[2];
      env.app_version_patch = m[3];
    }
  }

  return env;
}

/** Bitrise workflow id; `deploy` is an alias for the Slack-specific workflow. */
export function resolveBitriseWorkflowId(workflow) {
  const w = String(workflow ?? "").trim();
  return w === "deploy" ? "deployFromSlack" : w;
}

export function buildBitriseRequestBody(command) {
  const env = buildBitriseEnvironmentsForApi(command);
  const actor =
    String(command.actor?.userName ?? "").trim() ||
    String(command.actor?.userId ?? "").trim() ||
    "slack-build-iqc-vercel";

  return {
    hook_info: {
      type: "bitrise",
    },
    build_params: {
      branch: command.branch,
      workflow_id: resolveBitriseWorkflowId(command.workflow),
      commit_message: formatBitriseTriggerMessage(command),
      environments: Object.entries(env).map(([key, value]) => ({
        mapped_to: key,
        value,
        is_expand: false,
      })),
    },
    triggered_by: actor,
  };
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
