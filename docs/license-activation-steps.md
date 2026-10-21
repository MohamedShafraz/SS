# Online Activation Steps

Use this flow when building a client installer. The client can use the POS offline after activation, but first activation needs internet.

## 1. Generate Signing Keys

Run this once on your private machine, either from the main project or from the `server/` folder:

```powershell
npm.cmd run license:keys
```

Keep `LICENSE_PRIVATE_KEY_PEM` only on your activation server. Put `LICENSE_PUBLIC_KEY_PEM` into the POS build environment.

## 2. Host The Activation Server On Vercel

Deploy only the `server/` folder to Vercel. The offline installer will still be built locally and given to the client as an `.exe`; Vercel is only the license server.

You can do this in either of these ways:

- Put `server/` into its own private Git repo and import that repo in Vercel.
- Keep this repo, but set the Vercel project root directory to `server`.

Create a Vercel KV database for the project, then add these environment variables in Vercel:

```text
LICENSE_PRIVATE_KEY_PEM=your private key
LICENSE_KEY_ID=offline-license-2026-01
ACTIVATION_ADMIN_TOKEN=random long admin token
KV_REST_API_URL=from Vercel KV
KV_REST_API_TOKEN=from Vercel KV
```

Your activation URL will be:

```text
https://your-vercel-domain.vercel.app/api/activation/activate
```

Make sure this activation endpoint is publicly reachable. Do not put the activation deployment behind Vercel Deployment Protection, password protection, or SSO. The protected admin endpoints (`/api/activation/issue` and `/api/activation/clients`) are secured with `ACTIVATION_ADMIN_TOKEN`, but `/api/activation/activate` must accept client POST requests from installed offline POS apps.

## 3. Issue A Client License

Call the protected Vercel endpoint from PowerShell:

```powershell
$body = @{
  licenseKey = "OFFLINE-GOODCHOICE-001"
  clientName = "GOOD CHOICE"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://your-vercel-domain.vercel.app/api/activation/issue" `
  -Method Post `
  -Headers @{ Authorization = "Bearer your random admin token" } `
  -ContentType "application/json" `
  -Body $body
```

## 4. Track Issued Client Licenses

Call the protected tracking endpoint to see which clients have received keys and whether those keys are activated:

```powershell
Invoke-RestMethod `
  -Uri "https://your-vercel-domain.vercel.app/api/activation/clients?status=all&limit=100" `
  -Method Get `
  -Headers @{ Authorization = "Bearer your random admin token" }
```

Optional query parameters:

```text
q=GOOD
status=issued | active | disabled | all
limit=100
```

The response includes `clientName`, `licenseKey`, `status`, `activated`, `activatedAt`, `expiresAt`, `createdAt`, and `updatedAt`.

For the local test server, you can also run:

```powershell
npm.cmd run license:list -- --status=all
```

## 5. Write The Client Build Config

On the build machine before packaging:

```powershell
$env:ACTIVATION_SERVER_URL="https://your-vercel-domain.vercel.app/api/activation/activate"
$env:LICENSE_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----..."
npm.cmd run write-license-config
```

This creates `client-build/license-config.json`. It contains only client-safe values.

## 6. Build The Client Installer

```powershell
npm.cmd run register-client -- --fresh --company="GOOD CHOICE" --license=OFFLINE-GOODCHOICE-001
npm.cmd run dist:win
```

Give the client only:

```text
release\MSHPOS Setup 0.1.0.exe
License key: OFFLINE-GOODCHOICE-001
```

## What Happens On The Client PC

1. Client installs the app.
2. Client opens the app and enters the license key.
3. The app contacts your activation server once.
4. The server binds the license to that machine fingerprint.
5. The app saves the signed license locally.
6. After that, POS works offline.

If the same key is typed on another machine, the server returns:

```text
This license is already activated on another device
```

## Local Test Server

The repo still includes `scripts/activation-server.cjs` for quick local testing without Vercel. Do not use its `activation-records.json` file as production storage on Vercel.

The standalone deployment version lives in `server/`.
