# Slack to Bitrise Build Trigger

Vercel Node.js API endpoint for the `/flutter-build` Slack slash command. It validates the Slack request, parses the build command, and triggers a Bitrise workflow with the requested branch and `ENV[...]` values.

## Command Format

```text
/flutter-build workflow:deploy | branch:development | ENV[build_env]:stage | ENV[platform_account]:liwa | ENV[build_ios]:true | ENV[build_android]:false | ENV[build_version]:0.0.12
```

Required parameters:

- `workflow`: Bitrise workflow to execute, for example `deploy`.
- `branch`: Git branch to build.
- `ENV[build_env]`: Must be `qa`, `pre`, `stage`, or `prod`.
- `ENV[platform_account]` (or `ENV[build_customer]` as an alias): Must exist in `ALLOWED_CUSTOMERS`. Sent to Bitrise as `platform_account` and `build_customer`.

Optional parameters:

- `ENV[build_ios]` / `ENV[build_android]`: `true` or `false`. Defaults: iOS `true`, Android `false`. Mapped to Bitrise `BUILD_IOS` and `BUILD_ANDROID`.
- `ENV[build_version]`: Semantic version `major.minor.patch` (for example `0.0.12` or `8.0.18`). The trigger adds `app_version_major`, `app_version_minor`, and `app_version_patch` for the workflow unless you set those `ENV[...]` keys yourself.
- `ENV[app_version_major]`, `ENV[app_version_minor]`, `ENV[app_version_patch]`: optional overrides; any other `ENV[...]` is also forwarded to Bitrise.

## Project Structure

```text
api/flutter-build.js                     # Vercel request handler
src/domain/buildCommand.js               # Command parsing and validation
src/infrastructure/bitriseClient.js      # Bitrise API integration
src/infrastructure/slackSignature.js     # Slack request verification
```

The view/request layer is intentionally thin. Command rules live in the domain module, and the Bitrise API call is isolated behind an infrastructure module.

## Environment Variables

Copy `.env.example` to `.env` for local development, and add the same values in Vercel Project Settings.

```bash
SLACK_SIGNING_SECRET=...
BITRISE_API_TOKEN=...
BITRISE_APP_SLUG=...
ALLOWED_CUSTOMERS=whitelabel,tanger,moa,wolfsburg,village,liwa
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
