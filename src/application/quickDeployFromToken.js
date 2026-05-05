/**
 * Rebuild a parsed Bitrise command from a verified quick-deploy confirmation token.
 *
 * @param {Record<string, unknown>} verified
 */
export function buildCommandFromVerifiedQuickDeploy(verified) {
  const branch = String(verified.branch ?? "").trim() || "development";
  const platform = String(verified.platform_account ?? "").trim();
  const buildEnv = String(verified.build_env ?? "").trim().toLowerCase();
  const version = String(verified.build_version ?? "").trim();
  const prev = String(verified.previous_version ?? "").trim();

  return {
    workflow: String(verified.workflow ?? "deployFromSlack").trim() || "deployFromSlack",
    branch,
    env: {
      build_env: buildEnv,
      platform_account: platform,
      build_customer: platform,
      build_version: version,
      build_ios: "true",
      build_android: "false",
      build_message: `Quick deploy ${platform} ${buildEnv} ${version} (from ${prev})`,
    },
  };
}
