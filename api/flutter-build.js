import { waitUntil } from "@vercel/functions";

import { executeBitriseDeployWithSlackNotify } from "../src/application/bitriseSlackDeploy.js";
import {
  executeReleaseAdd,
  executeReleaseDelete,
  ReleaseMutationError,
} from "../src/application/releaseCommands.js";
import { loadReleaseRowsForSlack } from "../src/application/releaseRowsLoader.js";
import {
  BuildCommandValidationError,
  buildSlackUsage,
  parseBuildCommand,
} from "../src/domain/buildCommand.js";
import { buildCatalogContext } from "../src/domain/coniqClients.js";
import {
  filterRowsByClientQuery,
  loadClientReleaseRows,
} from "../src/domain/clientReleases.js";
import { parseFlutterBuildIntent } from "../src/domain/flutterBuildIntent.js";
import {
  resolveWebHostingConfig,
  WebHostingConfigError,
} from "../src/domain/clientWebHosting.js";
import { QuickDeployError, computeNextPatchFromReleases } from "../src/domain/quickDeploy.js";
import { signQuickDeployToken } from "../src/infrastructure/quickDeployConfirmToken.js";
import { verifySlackSignature } from "../src/infrastructure/slackSignature.js";
import { buildClientListPayload } from "../src/presentation/slackClientList.js";
import { buildQuickDeployConfirmationPayload } from "../src/presentation/slackQuickDeploy.js";
import {
  buildAcknowledgementPayload,
} from "../src/presentation/slackBuildMessages.js";

const BACKEND_DEPLOYED_AT = new Date();

function formatBackendDeployedAtUtc(d) {
  const iso = d.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

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
        text: buildSlackUsage({ backendDeployedAt: formatBackendDeployedAtUtc(BACKEND_DEPLOYED_AT) }),
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

    if (intent.type === "quick_deploy") {
      const signingSecret = String(process.env.SLACK_SIGNING_SECRET ?? "").trim();
      if (!signingSecret) {
        return jsonResponse(200, {
          response_type: "ephemeral",
          text: "Quick deploy requires `SLACK_SIGNING_SECRET` (used to sign the confirmation button).",
        });
      }

      const allowedCustomers = parseAllowedCustomers(process.env.ALLOWED_CUSTOMERS);
      const slugLower = intent.platformSlug.trim().toLowerCase();
      if (
        allowedCustomers.length > 0 &&
        !allowedCustomers.some((c) => c.toLowerCase() === slugLower)
      ) {
        return jsonResponse(200, {
          response_type: "ephemeral",
          text: `ENV[platform_account] \`${intent.platformSlug}\` is not in ALLOWED_CUSTOMERS.`,
        });
      }

      const canonical =
        allowedCustomers.length > 0
          ? allowedCustomers.find((c) => c.toLowerCase() === slugLower) ?? intent.platformSlug.trim()
          : intent.platformSlug.trim();

      let rows;
      try {
        rows = await loadReleaseRowsForSlack();
      } catch (error) {
        console.error("Quick deploy: failed to load releases", error);
        return jsonResponse(200, {
          response_type: "ephemeral",
          text: `Could not load release table: ${error.message}`,
        });
      }

      const catalog = buildCatalogContext();
      let plan;
      try {
        plan = computeNextPatchFromReleases(rows, canonical, intent.buildEnv, catalog);
      } catch (error) {
        if (error instanceof QuickDeployError) {
          return jsonResponse(200, {
            response_type: "ephemeral",
            text: error.message,
          });
        }
        throw error;
      }

      const defaultBranch = String(process.env.DEFAULT_SLACK_DEPLOY_BRANCH ?? "").trim() || "development";
      const tag = String(intent.tag ?? "").trim();
      const branch = tag ? null : String(intent.branch ?? "").trim() || defaultBranch;
      const isWebBuild = intent.buildPlatform === "web";
      let webHosting = null;

      if (isWebBuild) {
        try {
          webHosting = resolveWebHostingConfig(canonical, intent.buildEnv);
        } catch (error) {
          if (error instanceof WebHostingConfigError) {
            return jsonResponse(200, {
              response_type: "ephemeral",
              text: error.message,
            });
          }
          throw error;
        }
      }

      const tokenPayload = {
        t: Date.now(),
        workflow: isWebBuild ? "deployWebapp" : "deployFromSlack",
        ...(tag ? { tag } : { branch }),
        platform_account: canonical,
        build_env: intent.buildEnv,
        build_version: plan.nextVersion,
        previous_version: plan.previousVersion,
        build_message: intent.commitMessage || "",
        build_debug: intent.buildDebug && !isWebBuild ? "true" : "false",
        ...(isWebBuild
          ? {
              build_platform: "web",
              aws_bucket_name: webHosting.web_hosting_s3_bucket,
              web_hosting_url: webHosting.web_hosting_url,
            }
          : {}),
      };
      const confirmToken = signQuickDeployToken(tokenPayload, signingSecret);

      return jsonResponse(
        200,
        buildQuickDeployConfirmationPayload({
          platformSlug: canonical,
          buildEnv: intent.buildEnv,
          previousVersion: plan.previousVersion,
          nextVersion: plan.nextVersion,
          branch,
          tag,
          confirmToken,
          commitMessage: intent.commitMessage,
          buildDebug: intent.buildDebug,
          buildPlatform: intent.buildPlatform,
          webHostingUrl: webHosting?.web_hosting_url,
          awsBucketName: webHosting?.web_hosting_s3_bucket,
        })
      );
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
          text: `${error.message}\n\n${buildSlackUsage({ backendDeployedAt: formatBackendDeployedAtUtc(BACKEND_DEPLOYED_AT) })}`,
        });
      }
      throw error;
    }

    waitUntil(
      executeBitriseDeployWithSlackNotify({
        command,
        responseUrl: slackPayload.response_url,
        userId: slackPayload.user_id,
        userName: slackPayload.user_name,
      })
    );

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

function parseAllowedCustomers(value) {
  return String(value ?? "")
    .split(",")
    .map((customer) => customer.trim())
    .filter(Boolean);
}
