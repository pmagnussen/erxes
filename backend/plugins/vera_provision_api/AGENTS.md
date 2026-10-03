# vera_provision_api

vera.fo fork plugin (not upstream). Machine API used by vera.fo
Tenant.Backend to set up a tenant's erxes without opening the UI.

- Port 3320, plugin name `veraprovision` (add to `ENABLED_PLUGINS_ONLY_API`).
  Routes via gateway: `/pl:veraprovision/provision...`.
- Auth: `Authorization: Bearer $VERA_PROVISION_TOKEN` (>=32 chars, unset =
  disabled). Tenant = request host (SaaS subdomain), like the rest of erxes.
- `POST /provision/init` — idempotent; body in `src/modules/provision/schema.ts`.
  Steps: brand (core `brands`), team channels, mail inbox on external
  IMAP/SMTP, ticket pipeline (+ own mailbox), Facebook = `pending` with a
  `connectUrl` the customer opens to sign in. 200 all ok, 207 some step failed
  (re-run to fix).
- `GET /provision` — brands, channels, pipelines, mail (no passwords).
- Owns no data. All writes go via tRPC: core `brands.*`, frontline
  `mailProvision.*` (`frontline_api/.../integrations/mail/trpc/provision.ts`).
