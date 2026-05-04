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

function toBitrisePayload(command) {
  return {
    hook_info: {
      type: "bitrise",
    },
    build_params: {
      branch: command.branch,
      workflow_id: command.workflow,
      environments: Object.entries(command.env).map(([key, value]) => ({
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
