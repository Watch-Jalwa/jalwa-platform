# Vercel Frontend Preview

Vercel is used only for reviewing the Next.js frontend. DigitalOcean remains the intended production runtime for the complete web application and FFmpeg worker.

## Import the project

1. In Vercel, create a new project and import `Watch-Jalwa/jalwa-platform` from GitHub.
2. Set **Root Directory** to `apps/web`.
3. Keep **Framework Preset** as Next.js.
4. Keep the repository connected so pull requests and branch pushes create preview deployments.

The app-level `vercel.json` supplies the install and build commands.

## Preview environment

Add this variable to the Vercel **Preview** environment:

```text
NEXT_PUBLIC_FRONTEND_PREVIEW=true
```

No Supabase, DeepSeek, payment, R2 or service-role secrets are required for the frontend-only preview. Public catalogue pages use built-in demo data when Supabase public configuration is absent.

The preview mode:

- skips Supabase session middleware when the backend is not configured;
- shows a visible frontend-preview banner;
- disables first-party analytics;
- marks the deployment as no-index;
- leaves backend-dependent actions visibly unavailable rather than using production secrets.

## Optional connected preview backend

For end-to-end QA, use a separate non-production Supabase project and separate test credentials. Add only preview-scoped values in Vercel. Never copy production service-role, payment or media-signing secrets into a public demonstration project.

## Recommended review flow

1. Push a feature branch or open a pull request.
2. Open the Vercel deployment URL attached to the GitHub commit or pull request.
3. Review responsive layouts, navigation, catalogue, shorts shell, pricing and legal pages.
4. Record backend-dependent defects separately for the DigitalOcean staging environment.

## Production boundary

Do not attach `watch-jalwa.com` to the Vercel preview project. The production domain should remain assigned to the DigitalOcean deployment after the full account-bootstrap workflow succeeds.
