# Netlify Environment Setup

Configure these values directly in the Netlify dashboard for this site.

Path:
`Site configuration -> Environment variables`

Required admin/auth variables:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH` or `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

Required database variable:
- `NETLIFY_DATABASE_URL_UNPOOLED`
- `NETLIFY_DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `DATABASE_URL`

Notes:
- Prefer `ADMIN_PASSWORD_HASH` over `ADMIN_PASSWORD`.
- Prefer the Netlify/Neon-provided database variables when the Neon integration is connected.
- Do not commit local `.env` files or copied Netlify exports into the repository.
- This repo intentionally does not include a tracked `.env` template file to avoid secret-scanning false positives during deploys.
