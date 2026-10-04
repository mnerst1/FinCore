# Validation report · 2026-10-04

Checked on Windows with Node.js **24.21.0**, npm **11.19.0**, Next.js **16.3.8**, Prisma **6.19.0** and a real temporary PostgreSQL **18.4** database. Docker is not installed in the authoring environment, so the Compose container itself was not started here. The committed migration was applied with `prisma migrate deploy` to PostgreSQL, and seed created the demo account successfully. The documented Compose image is PostgreSQL 17; no PostgreSQL 18-specific SQL features are used.

| Check | Result |
| --- | --- |
| Prisma generate | Passed |
| PostgreSQL migration | Passed |
| Demo seed | Passed; existing profiles preserved on repeat |
| ESLint | Passed without warnings |
| TypeScript strict check | Passed |
| Unit tests | **8 passed** |
| PostgreSQL integration tests | **8 passed** |
| Chromium browser/API scenarios | **3 passed** |
| Production build | Passed without warnings |
| Production server | Started successfully on loopback |
| Browser scenarios against production | **3 passed** |
| Responsive overview | 1440px desktop and 390px mobile verified |

The three production browser tests completed in approximately 10.5 seconds. They cover registration, login/logout, safe cookie flags, adding an account and expense through actual dialogs, search/empty states, rejected cross-origin mutations, rejected foreign/missing IDs, persisted Dark/Glass settings, Arabic RTL, principal repayment and reversal, idempotent recurring processing, budget reminders, receipt upload/download, another user's receipt denial, JSON backup with binary receipt contents, ID-remapped restore, attachment removal, password change with session revocation, desktop/mobile layout and mobile navigation.

The eight integration tests cover ownership enforcement, transfer invariants, category cycles, concurrent recurring calls, atomic import rollback, lossless financial backup restore, spreadsheet formula escaping and persisted authentication rate limits. Unit checks cover cents arithmetic, future exclusion, month-end recurrence, nested budgets, invalid dates/amounts, goal allocation limits, accent validation, salted hashes and primary locale key parity.

Two bugs found by verification were fixed: empty optional notes were converted to null, and outgoing page animations could retain an old empty-state button during navigation. Receipt backup/restore and streamed request-size limits were also verified. Windows requires stopping the dev server before regenerating Prisma for a production build, because the loaded query-engine DLL cannot be replaced while in use. This is reflected in INSTALL_RU.md.

Preview images in `docs/previews/` were captured from the real production application with generated sample data. Native date/month controls follow the browser/OS locale; translated application labels use the selected locale.

Follow-up verification: Docker Compose PostgreSQL 17 started successfully on this host, migrations and demo seed completed, and demo login returned HTTP 200. The authentication language now persists to the profile after successful login/registration. A browser regression test verified Russian across login, page reload, logout and another login, including the guest language restored from local storage. Lint and typecheck passed after this fix.

Not independently verified: Firefox/Safari, every manual checklist item, full-server `pg_dump` restoration, a separate native-speaker review, deployment beyond loopback, large-load performance and a formal security audit. Additional 12 locale dictionaries intentionally contain a core translation with English fallback; Settings reports measured key coverage. No universal-language claim is made.

No GitHub repository, remote deployment or external account was created. Runtime databases, receipts, environment secrets and generated dependencies are excluded from the deliverable ZIP.

Demo sign-in follow-up: the login screen now offers a translated demo button without displaying credentials. Its server endpoint uses the configured demo password and the existing login validation, rate limiter and secure session flow. A browser test verified one-click demo login with empty form fields, Russian locale persistence and rejection of a foreign Origin. Lint, typecheck and unit tests passed.

Sidebar follow-up: removed day numbering from the application title, login artwork, sidebar and footer. Added a translated, accessible desktop collapse/expand control with a persisted 78px icon menu; mobile navigation retains full labels. A browser regression test verified collapse/expand, navigation through icons, persistence after reload, full mobile navigation and no mobile horizontal overflow. Lint and typecheck passed.
