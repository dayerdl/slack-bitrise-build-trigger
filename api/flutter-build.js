import { waitUntil } from "@vercel/functions";

import {
  BuildCommandValidationError,
  buildSlackUsage,
  formatCommandSummary,
  parseBuildCommand,
} from "../src/domain/buildCommand.js";
import { triggerBitriseBuild } from "../src/infrastructure/bitriseClient.js";
import { verifySlackSignature } from "../src/infrastructure/slackSignature.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, {
      response_type: "ephemeral",
      text: "Use POST for the /flutter-build Slack command.",
    });
  }

  const rawBody = await readRawBody(request);
  const isVerified = verifySlackSignature({
    rawBody,
    timestamp: request.headers["x-slack-request-timestamp"],
    signature: request.headers["x-slack-signature"],
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  });

  if (!isVerified) {
    return sendJson(response, 401, {
      response_type: "ephemeral",
      text: "Slack signature verification failed.",
    });
  }

  const slackPayload = Object.fromEntries(new URLSearchParams(rawBody));
  const allowedCustomers = parseAllowedCustomers(process.env.ALLOWED_CUSTOMERS);

  let command;
  try {
    command = parseBuildCommand(slackPayload.text, { allowedCustomers });
  } catch (error) {
    if (error instanceof BuildCommandValidationError) {
      return sendJson(response, 200, {
        response_type: "ephemeral",
        text: `${error.message}\n\n${buildSlackUsage()}`,
      });
    }

    throw error;
  }

  waitUntil(triggerBuildAndNotifySlack({ command, slackPayload }));

  return sendJson(response, 200, {
    response_type: "in_channel",
    text: `Build request accepted: ${formatCommandSummary(command)}.`,
  });
}

async function triggerBuildAndNotifySlack({ command, slackPayload }) {
  try {
    const build = await triggerBitriseBuild({
      appSlug: process.env.BITRISE_APP_SLUG,
      apiToken: process.env.BITRISE_API_TOKEN,
      command,
    });

    await postSlackResponse(slackPayload.response_url, {
      response_type: "in_channel",
      text: build.buildUrl
        ? `Bitrise build triggered: <${build.buildUrl}|open build>.`
        : `Bitrise build triggered for ${formatCommandSummary(command)}.`,
    });
  } catch (error) {
    console.error("Failed to trigger Bitrise build", error);

    await postSlackResponse(slackPayload.response_url, {
      response_type: "ephemeral",
      text: `Bitrise build trigger failed: ${error.message}`,
    });
  }
}

async function postSlackResponse(responseUrl, payload) {
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

function parseAllowedCustomers(value) {
  return String(value ?? "")
    .split(",")
    .map((customer) => customer.trim())
    .filter(Boolean);
}

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

async function readRawBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}
