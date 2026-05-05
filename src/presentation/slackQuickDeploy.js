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
  confirmToken,
}) {
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
            `Branch: \`${escapeMrkdwn(branch)}\` · workflow: \`deployFromSlack\``,
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
