# Testing — Qooti Healthy Meals Platform

Automated end-to-end suites for backend, plus the manual test-case docs and Postman screenshots from earlier sprint runs.

## Automated suites

All three run against the live FastAPI server and verify state directly in
PostgreSQL. Start the backend first, then run each suite from the backend
directory so the venv (with `requests` + `psycopg2`) is used:

```bash
cd BACKEND/project/backend
.venv/bin/python -m uvicorn main:app          # terminal 1 — server

# terminal 2 — the suites
.venv/bin/python ../../../testing/test-subscriptions-payments.py
.venv/bin/python ../../../testing/test-restaurant-flow.py
.venv/bin/python ../../../testing/test-admin-flow.py
```

| Suite | Cases | Covers | Extra requirements |
|---|---|---|---|
| `test-subscriptions-payments.py` | 28 | Subscription creation, discount pricing, Moyasar 3D Secure payment lifecycle, DB transaction atomicity | `MOYASAR_SECRET_KEY` (test key) in backend `.env`, internet access, frontend dev server on `:5173` (the payment callback redirects to it) |
| `test-restaurant-flow.py` | 39 | Restaurant onboarding → admin approval → meal CRUD → client meal selections → restaurant orders view | — |
| `test-admin-flow.py` | 25 | Admin auth enforcement, overview counts, customers/orders lists, listing filters, approve/reject validation | — |

Each suite prints `[PASS]`/`[FAIL]` per case, a summary line, and exits non-zero
on any failure. All are idempotent — safe to re-run against the same database.

## Manual test docs

- [`test-cases-registration-login.md`](test-cases-registration-login.md) —
  registration/login test-case spec (not yet automated).
- [`test-cases-registration-login_result.md`](test-cases-registration-login_result.md) —
  manual execution results.
- [`test-cases-restaurants-meals_result.md`](test-cases-restaurants-meals_result.md) —
  main results doc: manual admin-approval and public-browsing runs, plus the
  automated suites' results and resolved API-contract questions.
- `screenshots/` — Postman evidence for the early manual runs.
