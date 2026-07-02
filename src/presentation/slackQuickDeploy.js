/**
 * Slack Block Kit for quick deploy confirmation (presentation only).
 */

function escapeMrkdwn(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildQuickDeployConfirmationPayload({
  platformSlug,
  buildEnv,
  previousVersion,
  nextVersion,
  branch,
  tag = null,
  confirmToken,
  commitMessage,
  buildDebug = false,
  buildPlatform = null,
  webHostingUrl = null,
  awsBucketName = null,
}) {
  const messageLine = String(commitMessage ?? "").trim()
    ? `\nMessage: _${escapeMrkdwn(String(commitMessage).trim())}_`
    : "";
  const isWeb = String(buildPlatform ?? "").trim().toLowerCase() === "web";
  const debugLine = buildDebug && !isWeb ? "\nBuild mode: *debug*" : "";
  const workflow = isWeb ? "deployWebapp" : "deployFromSlack";
  const webLine =
    isWeb && webHostingUrl && awsBucketName
      ? `\nWeb: \`${escapeMrkdwn(webHostingUrl)}\` → S3 \`${escapeMrkdwn(awsBucketName)}\``
      : isWeb
        ? "\nPlatform: *web*"
        : "";
  const refLine = tag
    ? `Tag: \`${escapeMrkdwn(tag)}\``
    : `Branch: \`${escapeMrkdwn(branch)}\``;
  return {
    response_type: "ephemeral",
    replace_original: false,
    text: `Deploy ${platformSlug} ${buildEnv} ${nextVersion}?`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*Quick deploy* · ${escapeMrkdwn(platformSlug)} · *${escapeMrkdwn(buildEnv)}*\n` +
            `Latest in release table: \`${escapeMrkdwn(previousVersion)}\` → *${escapeMrkdwn(nextVersion)}*\n` +
            `${refLine} · workflow: \`${workflow}\`` +
            webLine +
            debugLine +
            messageLine,
        },
      },
      {
        type: "actions",
        block_id: "quick_deploy_actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Confirm deploy", emoji: true },
            style: "primary",
            action_id: "quick_deploy_confirm",
            value: confirmToken,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Cancel", emoji: true },
            action_id: "quick_deploy_cancel",
            value: "cancel",
          },
        ],
      },
    ],
  };
}
