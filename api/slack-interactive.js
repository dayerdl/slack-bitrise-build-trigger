import { waitUntil } from "@vercel/functions";

import { executeBitriseDeployWithSlackNotify } from "../src/application/bitriseSlackDeploy.js";
import { buildCommandFromVerifiedQuickDeploy } from "../src/application/quickDeployFromToken.js";
import { verifyQuickDeployToken } from "../src/infrastructure/quickDeployConfirmToken.js";
import { verifySlackSignature } from "../src/infrastructure/slackSignature.js";

export async function GET() {
  return new Response("Use POST for Slack interactivity.", { status: 405 });
}

export async function POST(request) {
  try {
    const rawBody = await request.text();

    const isVerified = verifySlackSignature({
      rawBody,
      timestamp: request.headers.get("x-slack-request-timestamp"),
      signature: request.headers.get("x-slack-signature"),
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    });

    if (!isVerified) {
      return new Response("Invalid signature", { status: 401 });
    }

    const params = new URLSearchParams(rawBody);
    const payloadJson = params.get("payload");
    if (!payloadJson) {
      return new Response("Missing payload", { status: 400 });
    }

    const outer = JSON.parse(payloadJson);

    if (outer.type !== "block_actions") {
      return Response.json({});
    }

    const signingSecret = String(process.env.SLACK_SIGNING_SECRET ?? "").trim();
    if (!signingSecret) {
      return Response.json({
        response_type: "ephemeral",
        replace_original: true,
        text: "Server misconfiguration: SLACK_SIGNING_SECRET is missing.",
      });
    }

    const action = outer.actions?.[0];
    if (!action) {
      return Response.json({ delete_original: true });
    }

    if (action.action_id === "quick_deploy_cancel") {
      return Response.json({
        response_type: "ephemeral",
        replace_original: true,
        text: "Cancelled — no build was triggered.",
      });
    }

    if (action.action_id === "quick_deploy_confirm") {
      const verified = verifyQuickDeployToken(action.value, signingSecret);
      if (!verified) {
        return Response.json({
          response_type: "ephemeral",
          replace_original: true,
          text: "This confirmation expired or is invalid. Run `/flutter-build <account> <env>` again.",
        });
      }

      const allowedCustomers = parseAllowedCustomers(process.env.ALLOWED_CUSTOMERS);
      const account = String(verified.platform_account ?? "");
      if (
        allowedCustomers.length > 0 &&
        !allowedCustomers.some((c) => c.toLowerCase() === account.toLowerCase())
      ) {
        return Response.json({
          response_type: "ephemeral",
          replace_original: true,
          text: "That platform account is not allowed.",
        });
      }

      const command = buildCommandFromVerifiedQuickDeploy(verified);

      waitUntil(
        executeBitriseDeployWithSlackNotify({
          command,
          responseUrl: outer.response_url,
        })
      );

      return Response.json({
        response_type: "ephemeral",
        replace_original: true,
        text: `Triggering Bitrise for *${command.env.platform_account}* · *${command.env.build_env}* · *${command.env.build_version}*…`,
      });
    }

    return Response.json({ delete_original: true });
  } catch (error) {
    console.error("slack-interactive handler failed", error);
    return Response.json({
      response_type: "ephemeral",
      replace_original: true,
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
