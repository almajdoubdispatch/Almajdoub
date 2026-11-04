# Website deployment

The canonical Cloudflare Pages project is `almajdoubdispatch`. Its Git root is `website_release_candidate`; it serves the static site and same-origin `/api/v1` Pages Functions. Production deploys from `main`; previews are disabled. Git path includes cover files at the website root and up to three nested levels, while exclusions remain for local databases, test folders, dependencies, environment files, certificates, and spreadsheets.

The API routes forward intake requests to the Supabase `public-intake` Edge Function using the Pages secret `INTAKE_PROXY_SECRET`. The Supabase function checks the presented value against a SHA-256 digest stored in a private database schema.

Required Pages environment variables:

- `SUPABASE_URL` (plain text)
- `SUPABASE_PUBLISHABLE_KEY` (publishable key)
- `INTAKE_PROXY_SECRET` (secret text)

The build runs inside `website_release_candidate`. Its script copies an explicit allowlist of public website assets into `dist`; markdown, drafts, local databases, source documents, tests, certificates, spreadsheets, and dependency directories are not copied to the deployment.
