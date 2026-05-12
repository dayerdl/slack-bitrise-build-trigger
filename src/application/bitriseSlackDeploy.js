import { triggerBitriseBuild } from "../infrastructure/bitriseClient.js";
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

export async function executeBitriseDeployWithSlackNotify({
  command,
  responseUrl,
  userId,
  userName,
}) {
  try {
    const commandWithActor = {
      ...command,
      env: {
        ...command.env,
        slack_triggered_by_user_id: String(userId ?? "").trim(),
        slack_triggered_by_user_name: String(userName ?? "").trim(),
      },
      actor: { userId, userName },
    };

    const build = await triggerBitriseBuild({
      appSlug: process.env.BITRISE_APP_SLUG,
      apiToken: process.env.BITRISE_API_TOKEN,
      command: commandWithActor,
    });

    await postSlackResponse(
      responseUrl,
      buildBitriseSuccessPayload({
        command,
        buildUrl: build.buildUrl,
        buildNumber: build.buildNumber,
        releaseTsvResult: { ok: false, reason: "pending" },
        userId,
        userName,
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
