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
| BUG-02 | JWT signing key is guessable and committed to the repository | Auth | Critical | **Open (partially addressed)** |
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

**Totals:** 13 defects — 8 fixed, 5 open.
Of the open items, **BUG-02, BUG-12, and BUG-13 must all be fixed before the
production deploy.** BUG-12 in particular means no customer can currently pay.

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

### BUG-02 — The JWT signing key is guessable and committed to the repository
**Severity:** Critical · **Area:** Authentication · **Status:** Open (partially addressed)

**Re-verified 2026-07-27.** This entry was originally filed as *"`SECRET_KEY` is
unset — JWTs signed with an unconfigured key."* That is no longer accurate:
`SECRET_KEY` has since been added to the backend `.env` and loads correctly
(confirmed via `dotenv_values`). The original finding is therefore **resolved**.
The entry stays Critical for two reasons that the original wording did not
cover, both of which are still live.

[`auth.py`](../BACKEND/auth.py) reads the key from the environment and uses it to
sign and verify every access token:

```python
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
```

**1. The key is low-entropy.** Its value is the project name followed by the
words "secret key" — 16 characters, no randomness. HS256 is a symmetric
algorithm, so anyone holding a single issued token can brute-force the key
offline, at no cost to the server and with nothing to trigger a rate limit. A
wordlist attack reaches a value of this shape quickly.

**2. The key is in version control.** `Stage4/BACKEND/.env` is **tracked** —
`.gitignore` does not list `.env`, and the file has been committed since
`38841e5`. Anyone with repository access can read the signing key directly
without attacking it at all. If this repository is or ever becomes public, the
key is public with it, and remains recoverable from git history even after the
file is removed from the working tree.

**Impact.** With the signing key, an attacker forges a token naming any
`user_id` and `user_type`. `get_current_user` verifies it as genuine, which
defeats every role check in the system, including `verify_admin` and the
admin-only routes behind it. Session security currently rests on the repository
staying private.

**Repro:**

```bash
git ls-files --error-unmatch Stage4/BACKEND/.env   # tracked
grep -c SECRET_KEY Stage4/BACKEND/.env             # 1 — set, and readable
git log --oneline --all -- "*/.env"                # present across 8 commits
```

**Honest caveat:** this was found by code and configuration inspection. I did
**not** attempt to forge a token or crack the key, so the severity reflects the
weakness of the control, not a demonstrated bypass.

**Recommended fix:**

1. Generate a strong random secret — `python3 -c "import secrets;
   print(secrets.token_urlsafe(64))"`.
2. Set it in the production environment's config vars (Render/Railway), **not**
   in a committed file.
3. Add `.env` to `.gitignore`, `git rm --cached` both tracked `.env` files, and
   commit a `.env.example` listing variable names with empty values.
4. Make `auth.py` fail fast at import rather than starting with no key:

```python
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not configured")
```

Rotating the key invalidates existing tokens, which is fine — nobody is in a
live session yet.

**Note:** removing `.env` from the working tree does not remove it from history.
Because the committed values are a local-only `DATABASE_URL` and a Moyasar
**sandbox** key, rewriting history is not proportionate here; rotating the JWT
secret and moving it out of the repo is. Any credential that becomes
production-real must be issued fresh, never reused from these files.

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
database connection and no third-party dependencies. It has not yet been run
against a deployed URL, because nothing is deployed yet — that is the last step
of the Sprint 4 checklist.
