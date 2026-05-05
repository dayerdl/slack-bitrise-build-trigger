const BITRISE_API_BASE_URL = "https://api.bitrise.io/v0.1";

export async function getBitriseBuild({ appSlug, apiToken, buildSlug }) {
  if (!appSlug) {
    throw new Error("Missing BITRISE_APP_SLUG.");
  }
  if (!apiToken) {
    throw new Error("Missing BITRISE_API_TOKEN.");
  }
  if (!buildSlug) {
    throw new Error("Missing buildSlug.");
  }

  const res = await fetch(`${BITRISE_API_BASE_URL}/apps/${appSlug}/builds/${buildSlug}`, {
    headers: {
      Authorization: apiToken,
      "Content-Type": "application/json",
    },
  });

  const body = await readJsonSafely(res);
  if (!res.ok) {
    throw new Error(`Bitrise build lookup failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body?.data ?? body;
}

async function readJsonSafely(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

