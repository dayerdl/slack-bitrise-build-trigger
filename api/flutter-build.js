import { waitUntil } from "@vercel/functions";

import {
  BuildCommandValidationError,
  buildSlackUsage,
  parseBuildCommand,
} from "../src/domain/buildCommand.js";
import { triggerBitriseBuild } from "../src/infrastructure/bitriseClient.js";
import { verifySlackSignature } from "../src/infrastructure/slackSignature.js";
import {
  buildAcknowledgementPayload,
  buildBitriseErrorPayload,
  buildBitriseSuccessPayload,
} from "../src/presentation/slackBuildMessages.js";

function jsonResponse(statusCode, payload) {
  return Response.json(payload, { status: statusCode });
}

export async function GET() {
  return jsonResponse(405, {
    response_type: "ephemeral",
    text: "Use POST for the /flutter-build Slack command.",
  });
}

export async function POST(request) {
  try {
    // Vercel's Node `req` helpers parse the body; Slack needs the exact raw
    // string for signature verification. The Web Request API gives it intact.
    const rawBody = await request.text();

    const isVerified = verifySlackSignature({
      rawBody,
      timestamp: request.headers.get("x-slack-request-timestamp"),
      signature: request.headers.get("x-slack-signature"),
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    });

    if (!isVerified) {
      return jsonResponse(401, {
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
        return jsonResponse(200, {
          response_type: "ephemeral",
          text: `${error.message}\n\n${buildSlackUsage()}`,
        });
      }
      throw error;
    }

    waitUntil(triggerBuildAndNotifySlack({ command, slackPayload }));

    return jsonResponse(
      200,
      buildAcknowledgementPayload({
        command,
        userId: slackPayload.user_id,
        userName: slackPayload.user_name,
      })
    );
  } catch (error) {
    console.error("Unhandled error in /api/flutter-build", error);
    return jsonResponse(200, {
      response_type: "ephemeral",
      text: `Something went wrong: ${error.message}`,
    });
  }
}

async function triggerBuildAndNotifySlack({ command, slackPayload }) {
  try {
    const build = await triggerBitriseBuild({
      appSlug: process.env.BITRISE_APP_SLUG,
      apiToken: process.env.BITRISE_API_TOKEN,
      command,
    });

    await postSlackResponse(
      slackPayload.response_url,
      buildBitriseSuccessPayload({
        command,
        buildUrl: build.buildUrl,
        buildNumber: build.buildNumber,
      })
    );
  } catch (error) {
    console.error("Failed to trigger Bitrise build", error);

    await postSlackResponse(
      slackPayload.response_url,
      buildBitriseErrorPayload({ message: error.message })
    );
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
