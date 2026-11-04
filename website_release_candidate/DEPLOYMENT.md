# Website deployment

The canonical Cloudflare Pages project is `almajdoubdispatch`. Its Git root is `website_release_candidate`; it serves static files and the `/api/v1` Pages Functions in this directory. Production deploys from `main`; preview deployments are disabled. Path includes are empty so Cloudflare does not skip commits because of unmatched path filters. The configured path exclusions remain in place for local databases, tests, dependencies, environment files, certificates, and spreadsheets.

Cloudflare Pages provides the public site and same-origin API routes. The API routes forward intake requests to the Supabase `public-intake` Edge Function using the Pages environment secret `INTAKE_PROXY_SECRET`. The Supabase function verifies this value against a SHA-256 digest stored in the private database schema.

Required Pages environment variables:

- `SUPABASE_URL` (plain text)
- `SUPABASE_PUBLISHABLE_KEY` (publishable key)
- `INTAKE_PROXY_SECRET` (secret text)

The build runs only inside `website_release_candidate`. Its build script copies an explicit allowlist of public website assets into `dist`; tests, local databases, drafts, source documents, certificates, spreadsheets, and dependency directories are not copied to the deployment.
