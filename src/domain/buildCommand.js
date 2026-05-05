import { formatClientHelpAppendix } from "./coniqClients.js";

const VALID_BUILD_ENVS = new Set(["qa", "pre", "stage", "prod"]);

export function isValidBuildEnv(value) {
  return VALID_BUILD_ENVS.has(String(value ?? "").trim().toLowerCase());
}
const BOOLEAN_ENV_KEYS = new Set(["build_ios", "build_android", "BUILD_IOS", "BUILD_ANDROID"]);

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

  normalizeBuildAliases(env);

  if (!env.build_ios && !env.BUILD_IOS) {
    env.build_ios = "true";
  }
  if (!env.build_android && !env.BUILD_ANDROID) {
    env.build_android = "false";
  }

  validateCommand(fields, env, options);

  return {
    workflow: fields.workflow,
    branch: fields.branch,
    env,
  };
}

export function buildSlackUsage(options = {}) {
  const backendDeployedAt = String(options.backendDeployedAt ?? "").trim();
  const backendDeployedLine = backendDeployedAt
    ? `⏱ Backend deployed: *${backendDeployedAt}*`
    : "⏱ Backend deployed: _(unknown)_";

  return (
    [
      "*Flutter build / deploy*",
      "Release table: https://github.com/dayerdl/slack-bitrise-build-trigger/blob/main/data/client-releases.tsv",
      "",
      "✅ *Quick deploy (recommended)*",
      "Type two words: `<client> <env>`",
      "- Example: `/flutter-build moa stage`",
      "- Looks up the latest `major.minor.patch` version for that client in the release table (env column ignored), bumps patch (e.g. `1.2.4` → `1.2.5`), then asks you to *Confirm*.",
      "",
      "🛠️ *Manual deploy (advanced)*",
      "- `/flutter-build workflow:deployFromSlack | branch:development | ENV[build_env]:stage | ENV[platform_account]:liwa | ENV[build_ios]:true | ENV[build_android]:false | ENV[build_version]:0.0.12`",
      "- Optional: `ENV[build_message]:…` (text shown on the Bitrise build)",
      "",
      "📋 *List versions*",
      "- `/flutter-build list` (all clients)",
      "- `/flutter-build list bergen` (filter by slug or name)",
      "",
      "🧾 *Edit release table*",
      "- `/flutter-build release add | client:moa | version:4.2.400 | date:2026-05-04 | env:prod | status:released | notes:APP-999`",
      "- `/flutter-build release delete | client:moa | version:4.2.400`",
      "",
      backendDeployedLine,
    ].join("\n") + formatClientHelpAppendix()
  );
}

export function formatCommandSummary(command) {
  const envSummary = Object.entries(command.env)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  return `workflow=${command.workflow}, branch=${command.branch}, ${envSummary}`;
}

const BITRISE_COMMIT_MESSAGE_MAX = 500;

/**
 * Shown on the Bitrise build (API `build_params.commit_message`).
 * Optional `ENV[build_message]` overrides; it is not forwarded as a build env var.
 */
export function formatBitriseTriggerMessage(command) {
  const custom = String(command.env?.build_message ?? "").trim();
  if (custom) {
    return truncateUtf16ByLength(custom, BITRISE_COMMIT_MESSAGE_MAX);
  }

  const { build_message: _drop, ...restEnv } = command.env;
  return truncateUtf16ByLength(
    `Slack /flutter-build — ${formatCommandSummary({ ...command, env: restEnv })}`,
    BITRISE_COMMIT_MESSAGE_MAX
  );
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

function normalizeBuildAliases(env) {
  const platformAccount = env.platform_account || env.build_customer;
  if (platformAccount) {
    env.platform_account = platformAccount;
    env.build_customer = platformAccount;
  }
}

function validateCommand(fields, env, options) {
  requireValue(fields.workflow, "workflow");
  requireValue(fields.branch, "branch");
  requireValue(env.build_env, "ENV[build_env]");
  requireValue(env.platform_account, "ENV[build_customer] or ENV[platform_account]");

  if (!isValidBuildEnv(env.build_env)) {
    throw new BuildCommandValidationError("ENV[build_env] must be one of: qa, pre, stage, prod.");
  }

  if (env.build_version && !/^\d+\.\d+\.\d+$/.test(env.build_version)) {
    throw new BuildCommandValidationError("ENV[build_version] must use major.minor.patch format, for example 8.0.18.");
  }

  for (const key of BOOLEAN_ENV_KEYS) {
    if (env[key] && !["true", "false"].includes(env[key])) {
      throw new BuildCommandValidationError(`ENV[${key}] must be true or false.`);
    }
  }

  const allowedCustomers = options.allowedCustomers ?? [];
  if (allowedCustomers.length > 0 && !allowedCustomers.includes(env.platform_account)) {
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
