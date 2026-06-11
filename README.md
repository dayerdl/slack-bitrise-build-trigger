# Slack to Bitrise Build Trigger

Vercel Node.js API endpoint for the `/flutter-build` Slack slash command. It validates the Slack request, parses the build command, and triggers a Bitrise workflow with the requested branch and `ENV[...]` values.

## Command Format

```text
/flutter-build workflow:deployFromSlack | branch:development | ENV[build_env]:stage | ENV[platform_account]:liwa | ENV[build_ios]:true | ENV[build_android]:false | ENV[build_version]:0.0.12
```

Required parameters:

- `workflow`: Bitrise workflow id, for example `deployFromSlack`. The shorthand `deploy` is sent as `deployFromSlack`.
- `branch`: Git branch to build.
- `ENV[build_env]`: Must be `qa`, `pre`, `stage`, or `prod`.
- `ENV[platform_account]` (or `ENV[build_customer]` as an alias): Must exist in `ALLOWED_CUSTOMERS`. Sent to Bitrise as `platform_account` and `build_customer`.

Optional parameters:

- `ENV[build_ios]` / `ENV[build_android]`: `true` or `false`. Defaults: iOS `true`, Android `false`. Mapped to Bitrise `BUILD_IOS` and `BUILD_ANDROID`.
- `ENV[android_output_type]`: `apk` or `appbundle`. Defaults to `apk`; use `appbundle` to generate an Android App Bundle.
- `ENV[build_version]`: Semantic version `major.minor.patch` (for example `0.0.12` or `8.0.18`). The trigger adds `app_version_major`, `app_version_minor`, and `app_version_patch` for the workflow unless you set those `ENV[...]` keys yourself.
- `ENV[api_region]`: optional API region suffix. Use `r02` to point clients such as `sandboxsprings` to the `.r02` backend suffix.
- `ENV[app_version_major]`, `ENV[app_version_minor]`, `ENV[app_version_patch]`: optional overrides; any other `ENV[...]` is also forwarded to Bitrise.
- `ENV[build_message]`: optional text shown on the Bitrise build details (API `commit_message`). If omitted, a short summary of the slash command is used instead. This value is not injected as a Bitrise environment variable.

### Quick deploy (short form)

```text
/flutter-build moa stage
```

Optional debug build:

```text
/flutter-build moa stage --debug
/flutter-build moa stage "testing push notifications" --debug
```

Two words: **platform slug** (must match `ALLOWED_CUSTOMERS`, e.g. `moa`) and **build env** (`qa`, `pre`, `stage`, or `prod`). The app loads `data/client-releases.tsv` (GitHub API when configured, otherwise the bundled file), finds the **latest `major.minor.patch` version across all rows for that client** (the `env` column on those rows is ignored for version lookup—stage, pre, and prod all count), bumps the **patch** (e.g. latest overall `2.0.0` → deploy `2.0.1`), and shows an **ephemeral** message with **Confirm** / **Cancel** buttons. The Bitrise build still uses your chosen **second word** as `ENV[build_env]` (e.g. `moa stage` deploys with `build_env=stage`).

After you click **Confirm**, Bitrise runs workflow `deployFromSlack` on branch `DEFAULT_SLACK_DEPLOY_BRANCH` (default `development`) with `build_version` set to the new patch version. Quick deploy sets both `build_ios` and `build_android` to `true`; with `--debug`, it also sets `build_debug=true`.

**Slack app setup:** under *Interactivity & Shortcuts*, set **Interactivity** to On and **Request URL** to `https://<your-deployment>/api/slack-interactive` (same host as the slash command). Use the same **Signing Secret** as for the slash command.

### Updating the release table only after success

To append a row only when the build finishes successfully, set up a **Bitrise outgoing webhook** (event: build finished) pointing to:

`https://<your-deployment>/api/bitrise-webhook`

Add a custom header in Bitrise (outgoing webhook headers):

- `X-Bitrise-Webhook-Secret`: `<your BITRISE_WEBHOOK_SECRET>`

Then set `BITRISE_WEBHOOK_SECRET` in your deployment env vars to the same value.

## Project Structure

```text
api/flutter-build.js                     # Slash command handler
api/slack-interactive.js                 # Button actions (quick deploy confirm/cancel)
src/domain/buildCommand.js               # Command parsing and validation
src/infrastructure/bitriseClient.js      # Bitrise API integration
src/infrastructure/slackSignature.js     # Slack request verification
data/client_slug_to_tsv.json             # Coniq folder slug → `client-releases.tsv` client column
data/client_slug_to_app_name.json        # Optional: Coniq folder slug → user-facing app/program name (shown in help)
```

The view/request layer is intentionally thin. Command rules live in the domain module, and the Bitrise API call is isolated behind an infrastructure module.

## Environment Variables

Copy `.env.example` to `.env` for local development, and add the same values in Vercel Project Settings.

```bash
SLACK_SIGNING_SECRET=...
BITRISE_API_TOKEN=...
BITRISE_APP_SLUG=...
ALLOWED_CUSTOMERS=whitelabel,tanger,moa,wolfsburg,village,liwa,macerich
DEFAULT_SLACK_DEPLOY_BRANCH=development
```

`BITRISE_API_TOKEN` must be a Bitrise personal access token that can trigger builds for `BITRISE_APP_SLUG`.

## Local Development

```bash
npm install
npm run dev
```

The local endpoint will be available at:

```text
POST http://localhost:3000/api/flutter-build
```

Slack signature verification is required, so the easiest manual end-to-end test is through Slack after exposing the local server with a tunnel.

## Deploy to Vercel

```bash
npm install
npx vercel
```

Set the production environment variables:

```bash
npx vercel env add SLACK_SIGNING_SECRET production
npx vercel env add BITRISE_API_TOKEN production
npx vercel env add BITRISE_APP_SLUG production
npx vercel env add ALLOWED_CUSTOMERS production
```

Deploy:

```bash
npx vercel --prod
```

## Slack Setup

Create or update a Slack app:

1. Enable **Slash Commands**.
2. Create the command `/flutter-build`.
3. Set the Request URL to:

```text
https://your-vercel-project.vercel.app/api/flutter-build
```

4. Copy the Slack app **Signing Secret** into `SLACK_SIGNING_SECRET`.
5. Reinstall the Slack app to the workspace if Slack asks for it.

When a valid command is sent, Slack receives an immediate acknowledgement and then a follow-up message with the Bitrise build link or an error.

## Tests

```bash
npm test
```
