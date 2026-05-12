import { triggerBitriseBuild } from "../infrastructure/bitriseClient.js";
import { formatCommandSummary } from "../domain/buildCommand.js";
import {
  buildBitriseErrorPayload,
  buildBitriseSuccessPayload,
} from "../presentation/slackBuildMessages.js";

const RELEASES_CHANNEL = "#flutter-app-releases";

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

async function postBuildTriggeredToChannel({ command, buildUrl, buildNumber, userId, userName }) {
  const token = String(process.env.SLACK_BOT_TOKEN ?? "").trim();
  if (!token) {
    return;
  }

  const actor = userId ? `<@${userId}>` : userName ? `@${userName}` : "Someone";
  const env = command.env;
  const version = env.build_version ? ` *${env.build_version}*` : "";
  const debug = env.build_debug === "true" ? " (debug)" : "";
  const buildLink = buildUrl ? `<${buildUrl}|#${buildNumber ?? "build"}>` : "";

  const text = [
    `🚀 ${actor} triggered a build:`,
    `*${env.platform_account ?? "—"}* · *${env.build_env ?? "—"}*${version}${debug}`,
    buildLink,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: RELEASES_CHANNEL,
        text,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!body?.ok) {
      console.warn("postBuildTriggeredToChannel failed", { status: res.status, error: body?.error });
    }
  } catch (error) {
    console.warn("postBuildTriggeredToChannel error", error);
  }
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
      actor: { userId, userName },
    };

    const build = await triggerBitriseBuild({
      appSlug: process.env.BITRISE_APP_SLUG,
      apiToken: process.env.BITRISE_API_TOKEN,
      command: commandWithActor,
    });

    await Promise.all([
      postSlackResponse(
        responseUrl,
        buildBitriseSuccessPayload({
          command,
          buildUrl: build.buildUrl,
          buildNumber: build.buildNumber,
          releaseTsvResult: { ok: false, reason: "pending" },
          userId,
          userName,
        })
      ),
      postBuildTriggeredToChannel({
        command,
        buildUrl: build.buildUrl,
        buildNumber: build.buildNumber,
        userId,
        userName,
      }),
    ]);
  } catch (error) {
    console.error("Failed to trigger Bitrise build", error);

    await postSlackResponse(
      responseUrl,
      buildBitriseErrorPayload({ message: error.message })
    );
  }
}
