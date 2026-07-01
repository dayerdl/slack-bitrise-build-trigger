/**
 * Rebuild a parsed Bitrise command from a verified quick-deploy confirmation token.
 *
 * @param {Record<string, unknown>} verified
 */
export function buildCommandFromVerifiedQuickDeploy(verified) {
  const branch = String(verified.branch ?? "").trim() || "development";
  const platform = String(verified.platform_account ?? "").trim().toLowerCase();
  const buildEnv = String(verified.build_env ?? "").trim().toLowerCase();
  const version = String(verified.build_version ?? "").trim();
  const customMessage = String(verified.build_message ?? "").trim();
  const buildDebug = String(verified.build_debug ?? "").trim().toLowerCase() === "true";
  const buildPlatform = String(verified.build_platform ?? "").trim().toLowerCase();
  const isWeb = buildPlatform === "web";
  const env = {
    build_env: buildEnv,
    platform_account: platform,
    build_customer: platform,
    build_version: version,
    build_ios: isWeb ? "false" : "true",
    build_android: isWeb ? "false" : "true",
  };

  if (isWeb) {
    env.build_platform = "web";
    if (verified.aws_bucket_name) {
      env.aws_bucket_name = String(verified.aws_bucket_name).trim();
    }
    if (verified.web_hosting_url) {
      env.web_hosting_url = String(verified.web_hosting_url).trim();
    }
  }

  if (buildDebug && !isWeb) {
    env.build_debug = "true";
  }

  if (customMessage) {
    env.build_message = customMessage;
  }

  const defaultWorkflow = isWeb ? "deployWebapp" : "deployFromSlack";

  return {
    workflow: String(verified.workflow ?? defaultWorkflow).trim() || defaultWorkflow,
    branch,
    env,
  };
}
