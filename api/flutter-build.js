import { waitUntil } from "@vercel/functions";

import {
  BuildCommandValidationError,
  buildSlackUsage,
  parseBuildCommand,
} from "../src/domain/buildCommand.js";
import {
  executeReleaseAdd,
  executeReleaseDelete,
  ReleaseMutationError,
} from "../src/application/releaseCommands.js";
import { buildCatalogContext } from "../src/domain/coniqClients.js";
import { filterRowsByClientQuery, loadClientReleaseRows } from "../src/domain/clientReleases.js";
import { parseFlutterBuildIntent } from "../src/domain/flutterBuildIntent.js";
import { triggerBitriseBuild } from "../src/infrastructure/bitriseClient.js";
import { verifySlackSignature } from "../src/infrastructure/slackSignature.js";
import { buildClientListPayload } from "../src/presentation/slackClientList.js";
import { persistReleaseRowAfterBitriseTrigger } from "../src/application/persistReleaseAfterBuild.js";
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
    // The host must pass the raw body; Slack needs the exact string for
    // signature verification. The Web Request API provides it intact.
    const rawBody = await request.text();

    const isVerified = verifySlackSignature({
      rawBody,
      timestamp: request.headers.get("x-slack-request-timestamp"),
      signature: request.headers.get("x-slack-signature"),
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    });

    if (!isVerified) {
      if (!String(process.env.SLACK_SIGNING_SECRET ?? "").trim()) {
        console.warn(
          "slack-bitrise: SLACK_SIGNING_SECRET is missing. Add it to the production environment and redeploy."
        );
      } else {
        console.warn(
          "slack-bitrise: Slack signature verification failed. Use the Signing Secret from api.slack.com → Your App → Basic Information (no extra spaces). Redeploy after changing env."
        );
      }
      return jsonResponse(401, {
        response_type: "ephemeral",
        text: "Slack signature verification failed.",
      });
    }

    const slackPayload = Object.fromEntries(new URLSearchParams(rawBody));
    const intent = parseFlutterBuildIntent(slackPayload.text);

    if (intent.type === "empty" || intent.type === "help") {
      return jsonResponse(200, {
        response_type: "ephemeral",
        text: buildSlackUsage(),
      });
    }

    if (intent.type === "list") {
      try {
        const allRows = loadClientReleaseRows();
        const catalog = buildCatalogContext();
        const clientQuery = intent.clientQuery;
        const rows = clientQuery
          ? filterRowsByClientQuery(allRows, clientQuery, catalog)
          : allRows;
        if (clientQuery && rows.length === 0) {
          return jsonResponse(200, {
            response_type: "ephemeral",
            text: `No client matched \`${clientQuery}\`. Try a Coniq folder slug (e.g. \`moa\`, \`bergen\`) or a TSV client name.`,
          });
        }
        return jsonResponse(
          200,
          buildClientListPayload(rows, { clientQuery, catalog })
        );
      } catch (error) {
        console.error("Failed to load client releases", error);
        return jsonResponse(200, {
          response_type: "ephemeral",
          text: `Could not load release data: ${error.message}`,
        });
      }
    }

    if (intent.type === "release_add" || intent.type === "release_delete") {
      try {
        const { slugToTsv } = buildCatalogContext();
        const text =
          intent.type === "release_add"
            ? await executeReleaseAdd(intent.fieldText, slugToTsv)
            : await executeReleaseDelete(intent.fieldText, slugToTsv);
        return jsonResponse(200, {
          response_type: "ephemeral",
          text,
        });
      } catch (error) {
        if (error instanceof ReleaseMutationError) {
          return jsonResponse(200, {
            response_type: "ephemeral",
            text: error.message,
          });
        }
        console.error("Release mutation failed", error);
        return jsonResponse(200, {
          response_type: "ephemeral",
          text: `Could not update releases: ${error.message}`,
        });
      }
    }

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

    let releaseTsvResult;
    try {
      releaseTsvResult = await persistReleaseRowAfterBitriseTrigger(command);
    } catch (syncError) {
      console.error("Release TSV sync after Bitrise failed", syncError);
      releaseTsvResult = { ok: false, reason: "error", message: syncError.message };
    }

    await postSlackResponse(
      slackPayload.response_url,
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
