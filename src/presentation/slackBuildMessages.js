import { formatCommandSummary } from "../domain/buildCommand.js";

/**
 * Slack Block Kit payloads for slash-command UX (presentation only).
 */

export function buildAcknowledgementPayload({ command, userId, userName }) {
  const actor = formatActor(userId, userName);
  const env = command.env;
  const summaryLine = formatCommandSummary(command);

  const fields = [
    { type: "mrkdwn", text: `*Workflow*\n${command.workflow}` },
    { type: "mrkdwn", text: `*Branch*\n${command.branch}` },
    { type: "mrkdwn", text: `*Env*\n${env.build_env ?? "—"}` },
    { type: "mrkdwn", text: `*Customer*\n${env.build_customer ?? "—"}` },
  ];

  if (env.build_version) {
    fields.push({ type: "mrkdwn", text: `*Version*\n${env.build_version}` });
  }

  const platforms = [];
  if (env.build_ios !== undefined) {
    platforms.push(`iOS: ${env.build_ios}`);
  }
  if (env.build_android !== undefined) {
    platforms.push(`Android: ${env.build_android}`);
  }
  if (platforms.length > 0) {
    fields.push({ type: "mrkdwn", text: `*Platforms*\n${platforms.join(" · ")}` });
  }

  return {
    response_type: "in_channel",
    text: `Flutter build queued — ${summaryLine} (${actor})`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🚀 Flutter build queued", emoji: true },
      },
      { type: "section", fields },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `${actor} triggered this · contacting Bitrise…`,
          },
        ],
      },
    ],
  };
}

export function buildBitriseSuccessPayload({ command, buildUrl, buildNumber, releaseTsvResult }) {
  const summaryLine = formatCommandSummary(command);
  const linkText = buildUrl
    ? `<${buildUrl}|Open build in Bitrise>`
    : "Build was triggered on Bitrise.";

  const title =
    buildNumber !== undefined && buildNumber !== null
      ? `Build running (#${buildNumber})`
      : "Build running on Bitrise";

  const contextElements = [{ type: "mrkdwn", text: summaryLine }];

  if (releaseTsvResult?.ok) {
    contextElements.push({
      type: "mrkdwn",
      text: "_`data/client-releases.tsv` updated on GitHub._",
    });
  } else if (releaseTsvResult?.reason === "no_mapping") {
    contextElements.push({
      type: "mrkdwn",
      text: "_Release list not updated: add a mapping in `data/build_customer_to_tsv_client.json` for this `ENV[build_customer]`._",
    });
  } else if (releaseTsvResult?.reason === "no_version") {
    contextElements.push({
      type: "mrkdwn",
      text: "_Release list not updated: set `ENV[build_version]` to record a version row._",
    });
  } else if (releaseTsvResult?.reason === "duplicate") {
    contextElements.push({
      type: "mrkdwn",
      text: "_Release list: a row for this client and version already exists (unchanged)._",
    });
  }

  return {
    response_type: "in_channel",
    text: `Bitrise build started — ${buildUrl ?? summaryLine}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `✅ ${title}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: linkText,
        },
      },
      {
        type: "context",
        elements: contextElements,
      },
    ],
  };
}

export function buildBitriseErrorPayload({ message }) {
  return {
    response_type: "ephemeral",
    text: `Bitrise build could not start: ${message}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Could not start Bitrise build*\n${message}`,
        },
      },
    ],
  };
}

function formatActor(userId, userName) {
  if (userId) {
    return `<@${userId}>`;
  }
  if (userName) {
    return `@${userName}`;
  }
  return "Someone";
}
