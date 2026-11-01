# AUM Estates operating manual

The current commands, security model, deployment and restore procedure are maintained in [README.md](README.md) and [deploy/README.md](deploy/README.md).

SQLite is the sole inventory authority. Use the CRM or `npm run manage` for edits, `npm run rollback` for the last eligible CLI change, `npm run build` to regenerate public feeds, and `npm run package` for a tested static bundle. Do not edit generated inventory files or restore legacy JSON backups over the database.

`npm start` runs the integrated website and private CRM at `http://127.0.0.1:8787/`. Provision an account with `npm run setup:admin -- --generate`; credentials are saved privately, never prefilled in the login page. `npm run serve` is a static-only preview and does not record leads.

Local smoke checks and tests do not prove that the production API, headers or lead capture are deployed. Complete the deployment acceptance procedure before announcing an operational release.
