# Website deployment

The canonical Cloudflare Pages project is `almajdoubdispatch`. Its Git root is `website_release_candidate`; it serves static files and the `/api/v1` Pages Functions in this directory. The production branch is `main`. Commits that change this website directory trigger production deployment; preview deployments are disabled.

Cloudflare Pages provides the public site and same-origin API routes. The API routes forward intake requests to the Supabase `public-intake` Edge Function using the Pages environment secret `INTAKE_PROXY_SECRET`. The Supabase function verifies this value against a SHA-256 digest stored in the private database schema.

Required Pages environment variables:

- `SUPABASE_URL` (plain text)
- `SUPABASE_PUBLISHABLE_KEY` (publishable key)
- `INTAKE_PROXY_SECRET` (secret text)

The Pages project builds only this website directory. Test fixtures, local databases, environment files, certificates, spreadsheets, and dependency directories are excluded by `.gitignore` and the Pages path filters.
