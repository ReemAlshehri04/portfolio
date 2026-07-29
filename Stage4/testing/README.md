# Testing — Qooti Healthy Meals Platform

Automated end-to-end suites for the backend.

## Automated suites

All three run against the live FastAPI server and verify state directly in
PostgreSQL. Start the backend first, then run each suite from the backend
directory so the venv (with `requests` + `psycopg2`) is used:

```bash
cd BACKEND
.venv/bin/python -m uvicorn main:app          # terminal 1 — server

# terminal 2 — the suites
.venv/bin/python ../testing/test-customer-flow.py
.venv/bin/python ../testing/test-restaurant-flow.py
.venv/bin/python ../testing/test-admin-flow.py
```

| Suite | Cases | Covers | Extra requirements |
|---|---|---|---|
| `test-customer-flow.py` | 45 | The Sprint 4 customer journey end to end: register → login → browse → select meals → pay → dashboard, including subscription creation, discount pricing, and the Moyasar 3D Secure payment lifecycle. The only suite that *asserts* on registration and login | `MOYASAR_SECRET_KEY` (test key) in backend `.env`, internet access, frontend dev server on `:5173` (the payment callback redirects to it) |
| `test-restaurant-flow.py` | 39 | Restaurant onboarding → admin approval → meal CRUD → client meal selections → restaurant orders view | — |
| `test-admin-flow.py` | 25 | Admin auth enforcement, overview counts, customers/orders lists, listing filters, approve/reject validation | — |

Between them the three suites cover the three end-to-end flows Sprint 4 asks of
QA (customer, restaurant, admin), for **109 cases** total.

Each suite prints `[PASS]`/`[FAIL]` per case, a summary line, and exits non-zero
on any failure. All are idempotent — safe to re-run against the same database.

## Choosing which environment to test

| Variable | Default | Purpose |
|---|---|---|
| `QOOTI_BASE_URL` | `http://127.0.0.1:8000` | API base URL to test against |
| `QOOTI_DATABASE_URL` | `DATABASE_URL` from the backend `.env` | Database the assertions read; must be the one behind `QOOTI_BASE_URL` |
| `QOOTI_ALLOW_REMOTE` | unset | Must be `1` to target any non-localhost host |

```bash
QOOTI_BASE_URL=https://qooti-api.onrender.com \
QOOTI_DATABASE_URL='postgresql://…' \
QOOTI_ALLOW_REMOTE=1 \
  .venv/bin/python ../testing/test-admin-flow.py
```

> ### ⚠️ These suites are not read-only
>
> They register users, edit restaurant approval state, cancel subscriptions,
> and delete the QA customer and their orders.
>
> That is why a non-localhost target requires `QOOTI_ALLOW_REMOTE=1`: it should
> be a deliberate act, never a stray environment variable. Point these at a
> staging database, not at production. For verifying a live deployment, use
> `smoke-check.py` below.

## Production smoke check

[`smoke-check.py`](smoke-check.py) verifies a deployed environment **without
writing to it** — safe to point at production, which is its whole purpose.
It needs no database credentials and no third-party packages (standard library
only), so it runs anywhere Python 3 does, including a deploy hook or CI:

```bash
QOOTI_BASE_URL=https://qooti-api.onrender.com python3 smoke-check.py
```

17 checks: service health and version, public browsing (including that no
unapproved restaurant leaks into the public list, and that a bad id returns a
clean 404 rather than a stack trace), auth enforcement on protected routes with
no token and with a forged one, and that a failed login reveals nothing about
the internals.

| Variable | Purpose |
|---|---|
| `QOOTI_BASE_URL` | API to check (default `http://127.0.0.1:8000`) |
| `QOOTI_FRONTEND_ORIGIN` | Deployed frontend URL — enables the CORS preflight check |
| `QOOTI_SMOKE_EMAIL` / `QOOTI_SMOKE_PASSWORD` | Enables a real login round-trip. Use a dedicated read-only QA account, never a customer's |

Checks needing variables you have not set report `SKIP`, not failure, so a bare
run against a fresh deploy still gives a meaningful pass. Exits non-zero if any
check fails.

## Bug report

- [`bug-report.md`](bug-report.md) — the Sprint 4 final bug report: all 14
  defects found across Sprints 1–4 with severity and fixed/open status.
  **All Critical findings are closed; the one remaining open item (BUG-06) is
  a documented design decision, not a release blocker.**
- `screenshots/` — Postman evidence from the early manual runs.
