import { formatClientHelpAppendix } from "./coniqClients.js";
import {
  isWebBuildPlatform,
  resolveWebHostingConfig,
  WebHostingConfigError,
} from "./clientWebHosting.js";
import { normalizeGitBranch } from "./gitRef.js";

const VALID_BUILD_ENVS = new Set(["qa", "pre", "stage", "prod"]);
const BOOLEAN_ENV_KEYS = new Set(["build_ios", "build_android", "build_debug"]);
const VALID_ANDROID_OUTPUT_TYPES = new Set(["apk", "appbundle"]);

export function normalizeAndroidOutputType(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "apk";
  }
  if (normalized === "aab") {
    return "appbundle";
  }
  return normalized;
}

export function isValidBuildEnv(value) {
  return VALID_BUILD_ENVS.has(String(value ?? "").trim().toLowerCase());
}

export class BuildCommandValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "BuildCommandValidationError";
  }
}

export function parseBuildCommand(input, options = {}) {
  const tokens = tokenizeCommand(input);
  const fields = {};
  const env = {};

  for (const token of tokens) {
    const envMatch = token.match(/^ENV\[([A-Za-z0-9_]+)\]:(.*)$/);

    if (envMatch) {
      const [, key, rawValue] = envMatch;
      env[key] = normalizeValue(rawValue);
      continue;
    }

    const separatorIndex = token.indexOf(":");
    if (separatorIndex === -1) {
      throw new BuildCommandValidationError(`Invalid token "${token}". Expected key:value or ENV[key]:value.`);
    }

    const key = token.slice(0, separatorIndex).trim();
    const rawValue = token.slice(separatorIndex + 1);
    fields[key] = normalizeValue(rawValue);
  }

  if (!env.build_ios) {
    env.build_ios = "true";
  }

  if (env.platform_account) {
    env.platform_account = env.platform_account.toLowerCase();
  }

  if (env.android_output_type) {
    env.android_output_type = normalizeAndroidOutputType(env.android_output_type);
  }

  if (fields.platform) {
    env.build_platform = String(fields.platform).trim().toLowerCase();
  }

  if (isWebBuildPlatform(env.build_platform)) {
    if (!fields.workflow) {
      fields.workflow = "deployWebapp";
    }
    env.build_ios = "false";
    env.build_android = "false";
  }

  validateCommand(fields, env, options);
  applyWebHostingEnv(fields, env);

  return {
    workflow: fields.workflow,
    branch: fields.branch ? normalizeGitBranch(fields.branch) : null,
    tag: fields.tag || null,
    env,
  };
}

/**
 * @param {{ backendDeployedAt?: string }} [options]
 */
export function buildSlackUsage(options = {}) {
  const backendDeployedAt = String(options.backendDeployedAt ?? "").trim();

  const body = [
    "📋 *Flutter build* — quick reference",
    "",
    "📚 *List & lookup*",
    "• `/flutter-build list` or `/flutter-build list all` — all clients and versions.",
    "• `/flutter-build list bergen` — filter one client (slug or table name).",
    "",
    "📝 *Release rows (manual)*",
    "• `/flutter-build release add | client:moa | version:4.2.400 | date:2026-05-04 | env:prod | status:released | notes:APP-999` — append",
    "• `/flutter-build release delete | client:moa | version:4.2.400` — remove",
    "",
    "🚀 *Full Bitrise trigger* (pipe-separated)",
    "• `/flutter-build workflow:deploy | branch:master | ENV[build_env]:prod | ENV[platform_account]:tanger | ENV[build_ios]:true | ENV[build_android]:false | ENV[build_version]:8.0.18`",
    "• Optional: `ENV[build_debug]:true` — builds a debug APK/IPA instead of release.",
    "• Optional: `ENV[android_output_type]:appbundle` (or `aab`) — builds an Android App Bundle instead of an APK (ignored for `prod`, which generates both APK and AAB).",
    "• Optional: `ENV[api_region]:r02` — points the API suffix to `.r02` (for example `sandboxsprings`).",
    "• Web: `workflow:deployWebapp | branch:development | ENV[build_env]:stage | ENV[platform_account]:macerich | platform:web | ENV[build_version]:1.0.0`",
    "",
    "⚡ *Quick deploy* (highest semver across all env rows for that client → bump patch → confirm in Slack)",
    "• `/flutter-build <client> <env>` — optional commit text in `\"` or `'`; add `--debug` for a debug build; add `branch:<name>` or `tag:<name>` to override the default ref.",
    "• Web quick deploy: `/flutter-build macerich stage platform:web` (uses `deployWebapp` + S3 bucket from `data/client_web_hosting.json`).",
    "• Example: `/flutter-build moa stage` — optional message/debug/ref: `/flutter-build moa stage \"testing PN\" --debug branch:feature/my-branch` or `tag:v4.0.0-stage`",
    "",
    "🔗 *Release table:* https://github.com/dayerdl/slack-bitrise-build-trigger/blob/main/data/client-releases.tsv",
    ""
  ];

  if (backendDeployedAt) {
    body.push("", `⏱ *Backend deployed:* ${backendDeployedAt}`);
  }

  return body.join("\n") + formatClientHelpAppendix();
}

export function formatAndroidOutputTypeLabel(env) {
  const buildEnv = String(env?.build_env ?? "").trim().toLowerCase();
  const buildAndroidEnabled =
    String(env?.build_android ?? "true").trim().toLowerCase() !== "false";
  if (buildEnv === "prod" && buildAndroidEnabled) {
    return "apk+aab";
  }
  return normalizeAndroidOutputType(env?.android_output_type ?? "apk");
}

export function formatCommandSummary(command) {
  const displayEnv = { ...command.env };
  displayEnv.android_output_type = formatAndroidOutputTypeLabel(command.env);

  const envSummary = Object.entries(displayEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  const refSummary = command.tag ? `tag=${command.tag}` : `branch=${command.branch}`;

  return `workflow=${command.workflow}, ${refSummary}, ${envSummary}`;
}

const BITRISE_COMMIT_MESSAGE_MAX = 500;

/**
 * Shown on the Bitrise build (API `build_params.commit_message`).
 * Optional `ENV[build_message]` overrides; it is not forwarded as a build env var.
 */
export function formatBitriseTriggerMessage(command) {
  const custom = String(command.env?.build_message ?? "").trim();
  const { build_message: _drop, ...restEnv } = command.env;

  const actorUserName = String(command?.actor?.userName ?? "").trim();

  const meta = [
    "slack_flutter_build",
    `platform_account=${String(command.env?.platform_account ?? "").trim()}`,
    `build_env=${String(command.env?.build_env ?? "").trim()}`,
    `build_version=${String(command.env?.build_version ?? "").trim()}`,
    actorUserName ? `slack_user_name=${actorUserName}` : null,
  ]
    .filter(Boolean)
    .join("|");

  const suffix = custom
    ? ` — ${custom}`
    : ` — ${formatCommandSummary({ ...command, env: restEnv })}`;

  return truncateUtf16ByLength(`${meta}${suffix}`, BITRISE_COMMIT_MESSAGE_MAX);
}

function truncateUtf16ByLength(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function tokenizeCommand(input) {
  const normalizedInput = String(input ?? "")
    .trim()
    .replace(/^\/flutter-build\b\s*/i, "");

  if (!normalizedInput) {
    throw new BuildCommandValidationError("Missing build command parameters.");
  }

  return normalizedInput
    .split("|")
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeValue(value) {
  return String(value ?? "").trim();
}

function validateCommand(fields, env, options) {
  requireValue(fields.workflow, "workflow");
  if (fields.branch && fields.tag) {
    throw new BuildCommandValidationError("Use either branch: or tag:, not both.");
  }
  if (!fields.branch && !fields.tag) {
    throw new BuildCommandValidationError("Missing required parameter: branch or tag.");
  }
  requireValue(env.build_env, "ENV[build_env]");
  requireValue(env.platform_account, "ENV[platform_account]");

  if (!isValidBuildEnv(env.build_env)) {
    throw new BuildCommandValidationError("ENV[build_env] must be one of: qa, pre, stage, prod.");
  }

  for (const key of BOOLEAN_ENV_KEYS) {
    if (env[key] && !["true", "false"].includes(env[key])) {
      throw new BuildCommandValidationError(`ENV[${key}] must be true or false.`);
    }
  }

  if (env.android_output_type && !VALID_ANDROID_OUTPUT_TYPES.has(env.android_output_type)) {
    throw new BuildCommandValidationError("ENV[android_output_type] must be one of: apk, appbundle.");
  }

  if (isWebBuildPlatform(env.build_platform)) {
    if (fields.workflow && fields.workflow !== "deployWebapp") {
      throw new BuildCommandValidationError("Web builds require workflow:deployWebapp.");
    }
  }

  const allowedCustomers = options.allowedCustomers ?? [];
  if (allowedCustomers.length > 0 && !allowedCustomers.some((c) => c.toLowerCase() === env.platform_account.toLowerCase())) {
    throw new BuildCommandValidationError(
      `ENV[platform_account] must be one of: ${allowedCustomers.join(", ")}.`
    );
  }
}

function requireValue(value, fieldName) {
  if (!value) {
    throw new BuildCommandValidationError(`Missing required parameter: ${fieldName}.`);
  }
}

function applyWebHostingEnv(fields, env) {
  if (!isWebBuildPlatform(env.build_platform)) {
    return;
  }

  try {
    const hosting = resolveWebHostingConfig(env.platform_account, env.build_env);
    env.aws_bucket_name = hosting.web_hosting_s3_bucket;
    env.web_hosting_url = hosting.web_hosting_url;
    fields.workflow = "deployWebapp";
  } catch (error) {
    if (error instanceof WebHostingConfigError) {
      throw new BuildCommandValidationError(error.message);
    }
    throw error;
  }
}
