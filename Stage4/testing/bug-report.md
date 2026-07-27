# Final Bug Report — Qooti Healthy Meals Platform

**Sprint 4 deliverable — QA Lead**
**Compiled:** 2026-07-25 · **Open items re-verified:** 2026-07-27
**Scope:** every defect found across Sprints 1–4, in the application and in the
test tooling itself.
**Sources:** manual Postman runs (Sprints 1–2), the three automated suites in this
directory, and the Sprint 4 regression pass.

Severity uses the labels agreed in the sprint plan:

| Label | Meaning |
|---|---|
| **Critical** | Security hole, data loss, or a blocked user journey. Must fix before release. |
| **Major** | A core rule is not enforced, or a flow breaks under a realistic input. |
| **Minor** | Cosmetic, contract-tidiness, or documentation. Safe to ship as-is. |

---

## Summary

| ID | Title | Area | Severity | Status |
|---|---|---|---|---|
| BUG-01 | Empty password accepted by request validation | Auth | Critical | **Fixed** |
| BUG-02 | Weak JWT signing key, committed to the repository | Auth | Critical | **Fixed** |
| BUG-12 | Payment page never sends the card fields — checkout always 422s | Frontend | Critical | **Open** |
| BUG-13 | Payment page hardcodes `127.0.0.1`, bypassing `VITE_API_BASE_URL` | Frontend | Critical | **Open** |
| BUG-03 | Invalid email format not rejected | Auth | Major | **Fixed** |
| BUG-04 | Negative age / weight accepted at registration | Auth | Major | **Fixed** |
| BUG-05 | Expired discount code returned 500 instead of 400 | Payments | Major | **Fixed** |
| BUG-06 | `subscription.status` is `'confirmed'` before payment | Subscriptions | Major | **Open** |
| BUG-07 | Test suites pointed at the pre-flatten backend path | Test tooling | Major | **Fixed** |
| BUG-08 | QA admin fixtures used an invalid email domain | Test tooling | Major | **Fixed** |
| BUG-09 | Restaurant fixture missing `restaurant_name`, failing silently | Test tooling | Major | **Fixed** |
| BUG-10 | Unknown `?status=` filter value silently ignored | Admin | Minor | **Open (accepted)** |
| BUG-11 | Result docs misspelled `_reselt`, breaking README links | Docs | Minor | **Fixed** |

**Totals:** 13 defects — 9 fixed, 4 open.
Of the open items, **BUG-12 and BUG-13 must both be fixed before release.**
BUG-12 means no customer can currently pay through the UI. The remaining two
open items are documented decisions rather than outstanding work: BUG-06 is a
schema change deferred by team agreement, and BUG-10 is an accepted contract.

---

## Open bugs

### BUG-12 — The payment page never sends the card fields; checkout always fails
**Severity:** Critical · **Area:** Frontend · **Status:** Open

[`Payment.jsx`](../FRONTEND/src/pages/Payment/Payment.jsx) collects
`cardholderName`, `cardNumber`, `expiryDate`, and `cvv` into component state and
marks all four inputs `required` — then never puts them in the request. The body
sent at line 38 is:

```js
body: JSON.stringify({
  subscription_id: orderData.subscriptionId,
  amount: orderData.totalPrice || 249,
}),
```

`PaymentProcessRequest` requires `card_number`, `card_expiry_month`,
`card_expiry_year`, `card_cvc`, and `card_holder_name`. None are sent.

**Impact.** Every checkout attempt fails validation. No customer can complete a
payment through the UI at all — the single most important flow in the product.

**Repro** (verified 2026-07-25 against the running server): send the exact body
above with a valid client token to `POST /api/payments` →

```
HTTP 422 — "card_number: Field required", "card_expiry_month: Field required",
"card_expiry_year: Field required", "card_cvc: Field required",
"card_holder_name: Field required"
```

**Why the automated suites did not catch this.** All 109 cases construct the API
payload themselves, so they prove the *backend* accepts a correct request.
`CPAY1` passes while the real page 422s. **No suite in this directory exercises
the frontend** — that gap is the actual finding here, and it applies to every
page, not just this one.

**Recommended fix:** map the form state to the API's field names and expand
`expiryDate` ("MM / YY") into `card_expiry_month` and `card_expiry_year`. Drop
the `amount` field while there — see the note below.

**Not a vulnerability:** the client-supplied `amount` is *not* a price-tampering
hole. `PaymentProcessRequest` has no `amount` field, so Pydantic discards it, and
[`payment_routes.py`](../BACKEND/routes/payment_routes.py) charges
`payment["amount"]` read from the database. The field is dead weight, and its
`|| 249` fallback disagrees with the real SAR 250 price, but it cannot affect
what a customer is charged.

---

### BUG-13 — The payment page hardcodes `127.0.0.1`, bypassing the API base URL
**Severity:** Critical · **Area:** Frontend · **Status:** Open

[`Payment.jsx`](../FRONTEND/src/pages/Payment/Payment.jsx) line 32 calls
`fetch("http://127.0.0.1:8000/api/payments", …)` directly. Four of the six
`fetch` call sites in the frontend correctly use
`import.meta.env.VITE_API_BASE_URL`; this one does not.

**Impact.** In any deployed build this requests `127.0.0.1` — the *visitor's own
machine* — so it fails for every user regardless of BUG-12. It works in
development only because the backend happens to be on that address locally.

**Repro:** `grep -rn "127.0.0.1:8000" FRONTEND/src/` → one hit, in `Payment.jsx`.

**Recommended fix:** route it through the same `VITE_API_BASE_URL` the rest of
the app uses, and set that variable to the deployed backend URL in the Vercel
project settings — `FRONTEND/.env` currently pins it to `http://localhost:8000`.

---

### BUG-06 — An unpaid subscription is already `'confirmed'`
**Severity:** Major · **Area:** Subscriptions · **Status:** Open (design)

[`schema.sql`](../BACKEND/schema.sql) declares:

```sql
status  subscription_status_enum  NOT NULL DEFAULT 'confirmed',
```

So a subscription is `'confirmed'` from the instant it is created, before any
money moves. The Sprint 3 plan specifies the opposite — *"Implement
POST /api/payments (process payment and update subscription status to
confirmed)"* — which implies subscriptions should start in a pending state and be
promoted by payment.

**Impact.** `subscription.status` cannot be used to tell paid orders from unpaid
ones. Only `payment.payment_status` carries that signal. Anything that reads
subscription status alone — a restaurant's order list, a revenue figure, an admin
dashboard count — risks treating an abandoned checkout as a real order.

**Repro:** create a subscription and read it back without paying:

```bash
psql "$DATABASE_URL" -c "SELECT s.status, p.payment_status FROM subscription s JOIN payment p USING (subscription_id) ORDER BY s.subscription_id DESC LIMIT 1;"
```

→ `confirmed | pending`

**Covered by:** `CPAY5` in [`test-customer-flow.py`](test-customer-flow.py), which
records the current behaviour deliberately so the dashboard assertions around it
cannot be misread.

**Recommended fix:** default the column to `'pending'` and have the payment
callback promote it to `'confirmed'`. This is a schema change plus a migration
for existing rows, which is why it is flagged rather than fixed inside Sprint 4 —
it needs the whole team's agreement, and every consumer of `status` has to be
re-checked.

---

### BUG-10 — Unknown `?status=` filter value is silently ignored
**Severity:** Minor · **Area:** Admin · **Status:** Open (accepted contract)

`GET /api/admin/restaurants?status=banana` returns **200 with the full
unfiltered list** instead of rejecting the value. A typo in a filter therefore
looks like a successful query, silently showing rejected and pending restaurants
where the caller expected a subset.

**Covered by:** `AR5` in [`test-admin-flow.py`](test-admin-flow.py), which asserts
the current behaviour as the documented contract.

**Recommendation:** return 422 for values outside
`pending|approved|rejected`. Left open by agreement — it is low priority, the
frontend only ever sends valid values, and changing it now would break `AR5` and
any client relying on the loose behaviour.

---

## Fixed bugs

### BUG-01 — Empty password accepted by request validation
**Severity:** Critical · **Area:** Authentication · **Status:** Fixed in `9059993`

Originally logged as **R8** in the Sprint 1 manual run. `password: ""` passed
Pydantic validation untouched; the request only failed later, and incidentally,
because health fields were missing. A client registering with a complete health
profile and an empty password would have had an account created with no password.

**Fix:** `password: str = Field(min_length=8)` in
[`schemas.py`](../BACKEND/schemas.py).

**Verified 2026-07-25:** empty and short passwords → **422**, no row created.
Regression-locked by `REG7` in [`test-customer-flow.py`](test-customer-flow.py).

---

### BUG-02 — Weak JWT signing key, committed to the repository
**Severity:** Critical · **Area:** Authentication · **Status:** Fixed — verified 2026-07-27

This entry was filed twice over. Originally: *"`SECRET_KEY` is unset — JWTs
signed with an unconfigured key."* On re-verification the key had been added but
was `qooti_secret_key` — the project name plus the words "secret key", 16
characters, no randomness — and `Stage4/BACKEND/.env` was **tracked in git**, so
the signing key was readable by anyone with repository access. HS256 is
symmetric, so either weakness alone would let an attacker forge a token naming
any `user_id`/`user_type` and defeat every role check, including `verify_admin`.

**Fix — four parts, all verified:**

| Part | Result |
|---|---|
| Key regenerated | 86-char `secrets.token_urlsafe(64)` value, local and Railway issued separately |
| `.env` untracked | `git rm --cached` on both files in `0ba58da`; they remain on disk |
| Ignored going forward | Two `.gitignore` files consolidated to one at the root that ignores `.env`/`.env.*` while allowing `.env.example`; templates added for backend and frontend |
| Fail-fast guard | [`auth.py`](../BACKEND/auth.py) now raises at import if the key is absent |

```python
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not configured")
```

The guard was tested both directions: import succeeds with the key set, and
raises `RuntimeError: SECRET_KEY is not configured` without it. This matters
more than it looks — before it existed, a misspelled variable in the deployment
config would let the service boot and fail confusingly at first login instead of
failing the deploy.

**Verified against the deployed environment 2026-07-27.**
[`smoke-check.py`](smoke-check.py) against the Railway backend: `USR1` login
returned a token, `USR2` used it to open `/api/users/me`, `USR3` confirmed the
returned profile matched the account that logged in. Signing and verification
therefore round-trip with a real key in production. `SEC2` and `SEC3` confirm
that a missing or malformed token is still rejected with 401.

**Scope of that evidence — stated precisely.** The round-trip proves the
deployed key works; it does not prove it is the specific value generated for
that environment, since any valid secret would pass identically. Confirming the
exact value requires reading it back from the host's config vars. `SEC3` sends a
malformed token, so it exercises token parsing, not signature verification —
it is not evidence about the key.

**Residual risk, accepted:** `qooti_secret_key` remains recoverable from git
history (commits `38841e5` through `0ba58da`). This is deliberate and safe —
the key was rotated, so the value in history signs nothing. The other committed
values were a `localhost` `DATABASE_URL` and a Moyasar **sandbox** key, so
rewriting history was judged disproportionate. Any credential that becomes
production-real must be issued fresh, never reused from those files.

---

### BUG-03 — Invalid email format not rejected
**Severity:** Major · **Area:** Authentication · **Status:** Fixed in `9059993`

Originally **R7**. `email: "not-an-email"` was accepted by the schema and only
failed downstream on unrelated business logic, so the error message pointed at
the wrong field.

**Fix:** the `email` field is typed `EmailStr`.

**Verified 2026-07-25:** → **422** naming the email field.
Regression-locked by `REG6`.

---

### BUG-04 — Negative age and weight accepted at registration
**Severity:** Major · **Area:** Authentication · **Status:** Fixed in `9059993`

Originally **R15**, and the one defect from the Sprint 1 run filed as a GitHub
issue (referenced as Issue #1 in the Sprint 1 manual test-case results).
`age: -5` returned **200** and created the user, storing a physically impossible
health profile that feeds the meal-recommendation logic.

**Fix:** bounded fields in [`schemas.py`](../BACKEND/schemas.py) —
`age: Field(None, gt=0, le=120)`, `height_cm` and `weight_kg` `gt=0`.

**Verified 2026-07-25:** `age: -5` → **422** `"Input should be greater than 0"`.

---

### BUG-05 — Expired discount code returned 500 instead of 400
**Severity:** Major · **Area:** Payments · **Status:** Fixed

Found by `SUB14` during the subscriptions run. The expiry check compared a
timezone-aware `NOW()` against a naive `expires_at` in Python, raising a
`TypeError` that surfaced as a 500 — an internal error where the customer should
have seen "this code has expired".

**Fix:** the comparison was moved into SQL, so Postgres handles the timezone.

**Verified:** `SUB14` → 400, green on every subsequent run.

---

### BUG-07 — Test suites pointed at the pre-flatten backend path
**Severity:** Major · **Area:** Test tooling · **Status:** Fixed in `9754304`

All three suites resolved the backend `.env` at `BACKEND/project/backend/.env`,
but the backend had been flattened to `BACKEND/`. Every suite died with
`FileNotFoundError` before its first assertion.

**Impact.** The whole automated regression net was dead. Nothing was catching
regressions between the flatten and 2026-07-25 — which is how BUG-08 and BUG-09
survived undetected.

**Fix:** corrected `ENV_FILE` in all three suites, plus the run instructions in
the docstrings and the README.

---

### BUG-08 — QA admin fixtures used an invalid email domain
**Severity:** Major · **Area:** Test tooling · **Status:** Fixed in `9754304`

`test-admin-flow.py` and `test-restaurant-flow.py` used `@qooti_admin.com` with
an underscore. The schema constraint `chk_admin_email_domain` requires
`@qooti-admin.com` with a hyphen, and an underscore is not legal in a domain
anyway — so `EmailStr` rejected it with 422, admin registration never happened,
and the suite then failed at login with a misleading 401.

**Fix:** corrected to `@qooti-admin.com` in both suites.

---

### BUG-09 — Restaurant fixture missing `restaurant_name`, failing silently
**Severity:** Major · **Area:** Test tooling · **Status:** Fixed in `9754304`

`test-subscriptions-payments.py` registered its restaurant without
`restaurant_name`, which became mandatory in `9059993`. Registration returned
**400**, but `register()` discards the response — so the failure was invisible
and resurfaced several calls later as an unexplained 401 at login.

**Root cause worth keeping in mind:** the silent-setup pattern, not the missing
field. All three original suites called register/login purely as plumbing and
never asserted on either, so any breakage in the most fundamental flow in the
product could only ever be observed indirectly.

**Fix:** the fixture now passes `restaurant_name`. More importantly,
[`test-customer-flow.py`](test-customer-flow.py) now asserts on registration and
login directly (`REG1`–`REG12`, `LOG1`–`LOG9`), so this class of failure reports
itself at its source.

---

### BUG-11 — Result docs misspelled `_reselt`, breaking README links
**Severity:** Minor · **Area:** Documentation · **Status:** Fixed in `9754304`

Both result documents were named `..._reselt.md`, while the README linked them as
`..._result.md`. Both links were dead.

**Fix:** renamed via `git mv` (history preserved) and updated the one code
reference in the `test-admin-flow.py` docstring.

---

## Deviations from the sprint plan — not defects

Recorded for the final review so they are not mistaken for bugs later.

- **Per-meal price.** The Sprint 2/3 plan describes meal cards and an order
  summary carrying a price per meal. The implementation uses a flat subscription
  price (SAR 250, halved from 500 in `18898a6`) and the `meal` table has no price
  column. This was a deliberate scope decision, consistently applied.
- **`POST /api/auth/logout`.** Returns 200 without server-side invalidation.
  Correct for stateless JWTs — the client discards the token — but worth stating
  plainly, since the endpoint's name implies more than it does.
- **Email comparison is case-sensitive.** `CaseTest@…` and `casetest@…` are
  different accounts (recorded as **L9** in the Sprint 1 run). Accepted as the
  intended behaviour; noted because most platforms fold case.

---

## Regression status at time of writing

All three automated suites, run against the local server and PostgreSQL on
2026-07-25:

| Suite | Cases | Result |
|---|---|---|
| [`test-customer-flow.py`](test-customer-flow.py) | 45 | 45 passed |
| [`test-restaurant-flow.py`](test-restaurant-flow.py) | 39 | 39 passed |
| [`test-admin-flow.py`](test-admin-flow.py) | 25 | 25 passed |
| **Total** | **109** | **109 passed, 0 failed** |

The pricing assertions were mutation-tested — `SAVE10` was temporarily changed to
50% in the database, three cases failed and the suite exited non-zero, then the
value was restored. The suites fail when the product is wrong, rather than
passing vacuously.

**Not yet covered:** `PUT /api/users/me`, and — more importantly — **the frontend.
Every case here talks to the API directly**, so a green run says nothing about
whether the pages actually work. BUG-12 is exactly that gap made concrete: the
customer-flow suite passes while real checkout is broken. Browser-level coverage
of the three journeys is the obvious next investment.

**Production verification.** The three suites can now be aimed at another
environment via `QOOTI_BASE_URL` / `QOOTI_DATABASE_URL`, but they write to
whatever they target — registering users, editing restaurant approval state,
and deleting the QA customer's data — so a non-localhost target requires an
explicit `QOOTI_ALLOW_REMOTE=1`, and they belong against staging rather than
production. For the live environment use [`smoke-check.py`](smoke-check.py): 17
read-only checks over health, public browsing, and auth enforcement, with no
database connection and no third-party dependencies.

**Run against the deployed environment, 2026-07-27 — 17 passed, 0 failed, 0
skipped.** Backend on Railway, frontend origin on Vercel.

| Group | Cases | Result |
|---|---|---|
| Service is up | 2 | passed — `/health` 200, API version 1.0.0 |
| Public browsing | 5 | passed — 4 approved restaurants, full nutrition on every card, clean 404 for an unknown restaurant |
| Auth enforcement | 6 | passed — missing, malformed, and non-existent-account requests all 401; no internals leaked in the error body |
| CORS | 1 | passed — preflight echoes the deployed frontend origin exactly, not a wildcard |
| Authenticated round-trip | 3 | passed — login issued a token, the token opened `/api/users/me`, the profile matched the account |

Three things this establishes beyond "the service responds":

* **The deployed signing key works.** The authenticated round-trip is the
  evidence behind closing BUG-02 — a token was issued and then verified by the
  same key in the live environment.
* **`FRONTEND_URL` is configured correctly.** The preflight returns the exact
  Vercel origin. This is the failure mode that no terminal-based check would
  otherwise catch: a wrong value leaves the backend looking perfectly healthy
  over curl while every request from the real frontend is blocked by the
  browser.
* **The database was provisioned from the current schema.** This is the first
  environment built without the discarded `review` table.

**What a green run here still does not cover.** Every check is an API call, so
this says nothing about whether the pages work — the same blind spot described
above, and the reason BUG-12 survived a fully green regression suite. The
deployment is verified as *reachable and correctly configured*, not as
*usable end to end*. Checkout in particular is still broken in the browser.
