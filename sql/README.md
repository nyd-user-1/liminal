# Database (NeonDB / Postgres)

1. Create a Neon project (`neon.tech`) and copy its connection string.
2. Apply schema + demo seed:

   ```sh
   psql "$DATABASE_URL" -f sql/001_schema.sql -f sql/002_seed.sql
   ```

3. Set `DATABASE_URL=<neon connection string>` in `.env.local` (without it the app runs on in-memory mocks).

Both files are idempotent — safe to re-run.

Demo logins (password `demo`):
- `brendan@liminal.demo` — admin/practitioner
- `casey@liminal.demo` — client portal
