import { triggerBitriseBuild } from "../infrastructure/bitriseClient.js";
import { persistReleaseRowAfterBitriseTrigger } from "./persistReleaseAfterBuild.js";
import {
  buildBitriseErrorPayload,
  buildBitriseSuccessPayload,
} from "../presentation/slackBuildMessages.js";

export async function postSlackResponse(responseUrl, payload) {
  if (!responseUrl) {
    return;
  }

  await fetch(responseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function executeBitriseDeployWithSlackNotify({ command, responseUrl }) {
  try {
    const build = await triggerBitriseBuild({
      appSlug: process.env.BITRISE_APP_SLUG,
      apiToken: process.env.BITRISE_API_TOKEN,
      command,
    });

    let releaseTsvResult;
    try {
      releaseTsvResult = await persistReleaseRowAfterBitriseTrigger(command);
    } catch (syncError) {
      console.error("Release TSV sync after Bitrise failed", syncError);
      releaseTsvResult = { ok: false, reason: "error", message: syncError.message };
    }

    await postSlackResponse(
      responseUrl,
      buildBitriseSuccessPayload({
        command,
        buildUrl: build.buildUrl,
        buildNumber: build.buildNumber,
        releaseTsvResult,
      })
    );
  } catch (error) {
    console.error("Failed to trigger Bitrise build", error);

    await postSlackResponse(
      responseUrl,
      buildBitriseErrorPayload({ message: error.message })
    );
  }
}
