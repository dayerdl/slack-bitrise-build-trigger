import { formatBitriseTriggerMessage } from "../domain/buildCommand.js";

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
  const account = String(env.platform_account ?? "").trim();
  if (account) {
    env.platform_account = account;
    env.build_customer = account;
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
    triggered_by: "slack-build-iqc-vercel",
  };
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
