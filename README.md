# MSHPOS website

This branch contains the public MSHPOS marketing website: the Microsoft Store path for the offline Windows POS, the custom online POS enquiry path, and the public privacy policy.

## Local development

Copy `.env.example` to `.env.local` and fill the Store URL. Add a Google Analytics 4 measurement ID only if website analytics are needed.

The site does not use a database, custom analytics API, analytics email service, or visitor profile store. Google Analytics is loaded only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured.

## Public routes

- `/` — marketing homepage
- `/privacy-policy` — canonical privacy policy
- `/privacy` — permanent redirect to `/privacy-policy`

## Deployment

Deploy as a server-hosted Next.js application on Vercel. Set `NEXT_PUBLIC_PRIVACY_POLICY_URL` to the deployed `/privacy-policy` URL before Microsoft Store submission.

Support: mshpos@proton.me
