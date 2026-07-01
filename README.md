# Slack → Bitrise build trigger

Vercel API for the `/flutter-build` Slack slash command. Validates Slack requests, parses the command, and triggers Bitrise (`deployFromSlack` for mobile, `deployWebapp` for web).

## Quick start (most common)

**Mobile quick deploy** — bump patch from the release table, confirm in Slack:

```text
/flutter-build moa stage
/flutter-build moa stage "smoke test" --debug
/flutter-build moa stage branch:feature/my-branch
```

**Web quick deploy** — same flow, uses `deployWebapp` + S3 bucket from `data/client_web_hosting.json`:

```text
/flutter-build macerich stage platform:web
/flutter-build balharbour prod platform:web
```

**List versions:**

```text
/flutter-build list
/flutter-build list moa
```

Type `/flutter-build help` in Slack for the full in-app reference.

---

## How quick deploy works

1. You send `<client> <env>` (e.g. `moa stage`).
2. The app reads `data/client-releases.tsv`, finds the **highest semver for that client** (all env rows count), and bumps the **patch**.
3. Slack shows **Confirm** / **Cancel** (ephemeral).
4. On confirm → Bitrise runs with `build_version` set to the new version.

| Quick deploy | Value |
|--------------|-------|
| Workflow (mobile) | `deployFromSlack` |
| Workflow (web) | `deployWebapp` |
| Branch | `DEFAULT_SLACK_DEPLOY_BRANCH` (default `development`) |
| `build_env` | Your second word (`qa`, `pre`, `stage`, `prod`) |
| Mobile platforms | iOS + Android (`--debug` → Android debug only, no iOS) |

**Slack interactivity:** enable *Interactivity* and set Request URL to `https://<your-host>/api/slack-interactive` (same Signing Secret as the slash command).

---

## Full command (pipe-separated)

For full control without the confirmation step:

```text
/flutter-build workflow:deploy | branch:development | ENV[build_env]:stage | ENV[platform_account]:moa | ENV[build_version]:4.3.26
```

`deploy` is an alias for `deployFromSlack`.

**Web (full form):**

```text
/flutter-build workflow:deployWebapp | branch:development | ENV[build_env]:stage | ENV[platform_account]:macerich | platform:web | ENV[build_version]:1.0.0
```

### Common `ENV[...]` keys

| Key | Notes |
|-----|--------|
| `build_env` | `qa`, `pre`, `stage`, `prod` |
| `platform_account` | Client slug; must be in `ALLOWED_CUSTOMERS` |
| `build_version` | `major.minor.patch` |
| `build_ios` / `build_android` | `true` / `false` (defaults: iOS `true`, Android `true` in quick deploy) |
| `build_debug` | `true` → debug Android build, skips iOS |
| `android_output_type` | `apk`, `appbundle`, or `aab`. **Prod + Android** → both APK and AAB |
| `api_region` | `r02` for `.r02` API suffix |
| `build_message` | Shown on the Bitrise build page (not a Bitrise env var) |

Any other `ENV[key]:value` is forwarded to Bitrise as-is.

---

## Release table webhook (optional)

Append a TSV row **only after a successful build**:

1. Bitrise outgoing webhook → `https://<your-host>/api/bitrise-webhook` (build finished).
2. Header `X-Bitrise-Webhook-Secret` = same value as env `BITRISE_WEBHOOK_SECRET`.

Only builds triggered via `/flutter-build` qualify (`commit_message` starts with `slack_flutter_build|`).

---

## Environment variables

Copy `.env.example` → `.env` locally; mirror in Vercel.

| Variable | Purpose |
|----------|---------|
| `SLACK_SIGNING_SECRET` | Slash command + button actions |
| `BITRISE_API_TOKEN` | Personal access token with trigger permission |
| `BITRISE_APP_SLUG` | Bitrise app id |
| `ALLOWED_CUSTOMERS` | Comma-separated client slugs (e.g. `moa,macerich,balharbour`) |
| `DEFAULT_SLACK_DEPLOY_BRANCH` | Quick deploy branch (default `development`) |
| `BITRISE_WEBHOOK_SECRET` | Optional; release table on success |
| `GITHUB_TOKEN` + `GITHUB_REPOSITORY` | Optional; live TSV from GitHub instead of bundled file |

---

## Slack app setup

1. Slash command `/flutter-build` → `https://<your-host>/api/flutter-build`
2. Interactivity → `https://<your-host>/api/slack-interactive`
3. Signing Secret → `SLACK_SIGNING_SECRET`
4. Reinstall the app to the workspace if prompted

---

## Local dev & deploy

```bash
npm install
npm run dev          # http://localhost:3000/api/flutter-build
npm test
```

Deploy: `npx vercel --prod` after setting production env vars (`npx vercel env add ...`).

Signature verification requires a real Slack request or a tunnel for end-to-end tests.

---

## Project layout

```text
api/flutter-build.js          # Slash command
api/slack-interactive.js      # Confirm / cancel buttons
api/bitrise-webhook.js        # Post-success release row
src/domain/                   # Parsing, quick deploy, web hosting map
src/infrastructure/           # Bitrise API, Slack signature, tokens
data/client-releases.tsv      # Version source for quick deploy
data/client_web_hosting.json  # Web S3 bucket + URL per client/env
```
