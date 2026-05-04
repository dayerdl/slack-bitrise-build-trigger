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
    body: JSON.stringify(toBitrisePayload(command)),
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

export function buildBitriseEnvironmentsForApi(command) {
  const env = { ...command.env };
  const account = firstNonEmpty(env.platform_account, env.build_customer);
  if (account) {
    env.platform_account = account;
    env.build_customer = account;
  }

  const buildIos = firstNonEmpty(env.BUILD_IOS, env.build_ios);
  if (buildIos) {
    env.BUILD_IOS = buildIos;
  }

  const buildAndroid = firstNonEmpty(env.BUILD_ANDROID, env.build_android);
  if (buildAndroid) {
    env.BUILD_ANDROID = buildAndroid;
  }

  const versionParts = splitBuildVersion(env.build_version);
  if (versionParts) {
    env.app_version_major ||= versionParts.major;
    env.app_version_minor ||= versionParts.minor;
    env.app_version_patch ||= versionParts.patch;
  }

  return env;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function splitBuildVersion(value) {
  const version = String(value ?? "").trim();
  if (!version) {
    return null;
  }

  const [major, minor, ...patchParts] = version.split(".");
  const patch = patchParts.join(".");
  if (!major || !minor || !patch) {
    return null;
  }

  return { major, minor, patch };
}

function toBitrisePayload(command) {
  const env = buildBitriseEnvironmentsForApi(command);
  return {
    hook_info: {
      type: "bitrise",
    },
    build_params: {
      branch: command.branch,
      workflow_id: command.workflow,
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
