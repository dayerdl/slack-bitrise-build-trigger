# Slack → Bitrise build trigger

Vercel API for the `/flutter-build` Slack slash command. Validates Slack requests, parses the command, and triggers Bitrise (`deployFromSlack` for mobile, `deployWebapp` for web).

## Quick start (most common)

**Mobile quick deploy** — bump patch from the release table, confirm in Slack:

```text
/flutter-build moa stage
/flutter-build moa stage "smoke test" --debug
/flutter-build moa stage branch:feature/my-branch
/flutter-build moa stage tag:v4.0.0-stage
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
| Tag | Optional; use `tag:<name>` or `--tag <name>` instead of branch (Bitrise clones that tag) |
| `build_env` | Your second word (`qa`, `pre`, `stage`, `prod`) |
| Mobile platforms | iOS + Android (`--debug` → Android debug only, no iOS) |

**Slack interactivity:** enable *Interactivity* and set Request URL to `https://<your-host>/api/slack-interactive` (same Signing Secret as the slash command).

---

## Full command (pipe-separated)

For full control without the confirmation step:

```text
/flutter-build workflow:deploy | branch:development | ENV[build_env]:stage | ENV[platform_account]:moa | ENV[build_version]:4.3.26
/flutter-build workflow:deploy | tag:v4.0.0-stage | ENV[build_env]:stage | ENV[platform_account]:moa | ENV[build_version]:4.3.26
```

Use `branch:` or `tag:` (not both). `deploy` is an alias for `deployFromSlack`.

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
| `android_output_type` | `apk`, `appbundle`, or `aab`. **Prod + Android** → both APK and AAB (APK → Firebase App Distribution; AAB → Google Play Internal Testing) |
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

## Uploading Bitrise workflow YAML (coniq_csa)

This Slack backend does **not** store the Flutter app `bitrise.yml`. Live workflows for **coniq_csa** live in Bitrise app config. The working copy is:

`/Users/dayerdl/coniq_csa/.cursor/bitrise.yaml`

App slug: `4ba1c99f-5ac5-4202-b937-d6a4bd592dfb`

### Upload (preferred)

Use the Cursor skill helper (token from `~/.cursor/mcp.json` → Bitrise MCP):

```bash
python3 ~/.cursor/skills/bitrise-upload-yml/scripts/upload_bitrise_yml.py
```

Upload + trigger example (web):

```bash
python3 ~/.cursor/skills/bitrise-upload-yml/scripts/upload_bitrise_yml.py \
  --trigger-workflow deployWebapp \
  --branch releases/sprint-26-14-macerich \
  --env build_env=stage \
  --env platform_account=macerich \
  --env build_version=0.0.23 \
  --env build_platform=web
```

### API shape

```http
POST https://api.bitrise.io/v0.1/apps/{APP_SLUG}/bitrise.yml
Content-Type: application/json

{"app_config_datastore_yaml": "<full yaml>"}
```

Prefer this REST call over MCP `update_bitrise_yml` for large YAML files (~75KB), which can hang.

Agent skill: `bitrise-upload-yml` (`~/.cursor/skills/bitrise-upload-yml/`).

---

## Google Play Internal Testing (prod AAB from Bitrise)

On **prod** Android builds (`ANDROID_BUILD_BOTH=true`), `deployFromSlack` uploads:

| Artifact | Destination |
|----------|-------------|
| APK | Firebase App Distribution |
| AAB | Google Play **Internal testing** |

Mall of America (`moa`) uses a **separate** Google Play developer account from the Coniq/default clients (e.g. Sandbox Springs). Repeat the one-time setup below for each Play account / app.

| Client (`platform_account`) | Android package | Play account |
|-----------------------------|-----------------|--------------|
| `moa` | `com.moa.MallofAmerica` | Mall of America (MOAC) Play Console |
| Default (e.g. `sandboxsprings`) | `com.coniq.<client>` (e.g. `com.coniq.sandboxsprings`) | Coniq / shared Play Console |

### 1. Create a service account and grant publish permissions

1. Open [Google Cloud Console](https://console.cloud.google.com/) for the GCP project linked to that Play account (e.g. Sandbox Springs prod).
2. **IAM & Admin → Service Accounts → Create service account** (name e.g. `bitrise-play-upload`).
3. Skip optional GCP roles → **Done**.
4. Open the service account → **Keys → Add key → Create new key → JSON** → download the file.
5. Open [Google Play Console](https://play.google.com/console/) → **Users and permissions → Invite new users**.
6. Paste the service account email. Sandbox Springs prod example: `bitrise@sandbox-springs-prod.iam.gserviceaccount.com`.
7. Grant **app access** for the target package with release / publish permissions (enough to upload to Internal testing).
8. Send / accept the invite so the account shows as **Active**.

### 2. Upload one build to Internal testing manually

Google Play API rejects automated uploads until the app has at least one binary in Play Console.

1. Play Console → select the app (`com.coniq.sandboxsprings` or `com.moa.MallofAmerica`).
2. **Test and release → Internal testing**.
3. Create a release and upload an AAB (e.g. from a Bitrise Artifacts download) once.
4. Save the release (draft or completed is fine for unlocking the API).

Until this exists, Bitrise/Firebase may report errors such as *This app is not published in the Google Play console*.

### 3. Enable Google Play Android Developer API

1. In Google Cloud Console (same project as the service account): **APIs & Services → Library**.
2. Search **Google Play Android Developer API**.
3. **Enable** it.
4. In Play Console → **Setup → API access** (or linked API project): confirm the Cloud project is linked and the service account appears with access.

### 4. Add the JSON key to Bitrise

Upload **one service-account JSON per Play developer account**. The workflow picks the file from `platform_account`:

| Client (`platform_account`) | File Storage ID | Env URL |
|-----------------------------|-----------------|---------|
| Mall of America (`moa`) | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_KEY_MOA` | `$BITRISEIO_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_KEY_MOA_URL` |
| Default / other clients (e.g. Sandbox Springs) | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_KEY` | `$BITRISEIO_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_KEY_URL` |

1. Bitrise app **coniq_csa** → **Code signing & files** (Files) → **Add file**.
2. Upload the service account JSON for that Play account.
3. Set the **File Storage ID** from the table above.
4. Save. Re-run a prod Android build (`apk+aab`) for that client.

The workflow step **Upload AAB to Google Play Internal Testing** downloads the matching key and runs `fastlane supply` with `--track internal` and `--package_name $FIXED_BUNDLE_ID`.

### Where to see the AAB

| Place | What you get |
|-------|----------------|
| Play Console → Internal testing | AAB release for testers |
| Bitrise → Build → Artifacts | Raw `.aab` download |
| Firebase App Distribution | APK only (not the AAB) |

Confluence: [Google Play Internal Testing — AAB upload from Bitrise](https://coniq.atlassian.net/wiki/spaces/CON/pages/2148040706/Google+Play+Internal+Testing+AAB+upload+from+Bitrise)

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
