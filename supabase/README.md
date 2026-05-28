# Supabase Setup

Use the SQL in `schema.sql` in the Supabase SQL editor before deploying the Vercel app.

Required Vercel environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Auth setup for v1:

- Enable email/password auth in Supabase.
- Add the Vercel production URL to Auth redirect URLs.
- Add the local dev URL, usually `http://localhost:5173`, to Auth redirect URLs.

The app keeps localStorage behavior when these env vars are missing. When they are present, Supabase is the source of truth after login.
