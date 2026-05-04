const VALID_BUILD_ENVS = new Set(["qa", "pre", "stage", "prod"]);
const BOOLEAN_ENV_KEYS = new Set(["build_ios", "build_android"]);

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

  validateCommand(fields, env, options);

  return {
    workflow: fields.workflow,
    branch: fields.branch,
    env,
  };
}

export function buildSlackUsage() {
  return [
    "Usage:",
    "`/flutter-build workflow:deploy | branch:master | ENV[build_env]:prod | ENV[build_customer]:tanger | ENV[build_ios]:true | ENV[build_android]:false | ENV[build_version]:8.0.18`",
    "",
    "Required: `workflow`, `branch`, `ENV[build_env]`, `ENV[build_customer]`.",
    "Allowed `build_env`: `qa`, `pre`, `stage`, `prod`.",
  ].join("\n");
}

export function formatCommandSummary(command) {
  const envSummary = Object.entries(command.env)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  return `workflow=${command.workflow}, branch=${command.branch}, ${envSummary}`;
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
  requireValue(fields.branch, "branch");
  requireValue(env.build_env, "ENV[build_env]");
  requireValue(env.build_customer, "ENV[build_customer]");

  if (!VALID_BUILD_ENVS.has(env.build_env)) {
    throw new BuildCommandValidationError("ENV[build_env] must be one of: qa, pre, stage, prod.");
  }

  for (const key of BOOLEAN_ENV_KEYS) {
    if (env[key] && !["true", "false"].includes(env[key])) {
      throw new BuildCommandValidationError(`ENV[${key}] must be true or false.`);
    }
  }

  const allowedCustomers = options.allowedCustomers ?? [];
  if (allowedCustomers.length > 0 && !allowedCustomers.includes(env.build_customer)) {
    throw new BuildCommandValidationError(
      `ENV[build_customer] must be one of: ${allowedCustomers.join(", ")}.`
    );
  }
}

function requireValue(value, fieldName) {
  if (!value) {
    throw new BuildCommandValidationError(`Missing required parameter: ${fieldName}.`);
  }
}
