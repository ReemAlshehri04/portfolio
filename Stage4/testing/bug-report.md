# Final Bug Report — Qooti Healthy Meals Platform

**Sprint 4 deliverable — QA Lead**
**Compiled:** 2026-07-25 · **Open items re-verified:** 2026-07-27 and 2026-07-28
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
| BUG-12 | Payment page never sends the card fields — page was an unreachable orphan, removed | Frontend | Critical | **Fixed** |
| BUG-13 | Payment page hardcodes `127.0.0.1` — same orphaned page, removed | Frontend | Critical | **Fixed** |
| BUG-14 | Moyasar callback URLs undocumented — localhost fallbacks masked the gap | Deployment | Critical | **Fixed** |
| BUG-03 | Invalid email format not rejected | Auth | Major | **Fixed** |
| BUG-04 | Negative age / weight accepted at registration | Auth | Major | **Fixed** |
| BUG-05 | Expired discount code returned 500 instead of 400 | Payments | Major | **Fixed** |
| BUG-06 | `subscription.status` is `'confirmed'` before payment | Subscriptions | Major | **Open** |
| BUG-07 | Test suites pointed at the pre-flatten backend path | Test tooling | Major | **Fixed** |
| BUG-08 | QA admin fixtures used an invalid email domain | Test tooling | Major | **Fixed** |
| BUG-09 | Restaurant fixture missing `restaurant_name`, failing silently | Test tooling | Major | **Fixed** |
| BUG-10 | Unknown `?status=` filter value silently ignored | Admin | Minor | **Fixed** |
| BUG-15 | No discount codes seeded — every code 404s in production | Payments | Major | **Fixed** |
| BUG-11 | Result docs misspelled `_reselt`, breaking README links | Docs | Minor | **Fixed** |

**Totals:** 15 defects — 14 fixed, 1 open.
**No open release blockers.** The single remaining open item, BUG-06, is a
documented design decision — a schema change deferred by team agreement, fully
scoped and scheduled as post-submission work.

---

## Open bugs

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

**Deferral re-affirmed 2026-07-28, two days before submission.** The fix was
fully scoped with the intent of shipping it, and the scoping itself is what
confirmed the deferral. Two findings from that work are recorded here so they
are not lost:

* **The impact is sharper than originally stated.** The restaurant orders view
  ([`meal_routes.py`](../BACKEND/routes/meal_routes.py), `get_restaurant_orders`)
  joins `subscription` with no payment filter, so an abandoned checkout puts
  real-looking order rows — customer name, phone, delivery address — in front
  of a restaurant that will never be paid for them. The admin overview's
  `total_orders` counts them too.
* **The fix is atomic across ownership boundaries.** The schema change breaks
  every checkout unless the meal-selection gate (`meal_routes.py`, which
  requires `status == 'confirmed'` *before* payment happens) changes in the
  same deployment — and that file belongs to another owner. Add a production
  data migration whose backfill retroactively reclassifies subscriptions
  restaurants have already seen, and the change is the highest-risk category
  possible this close to the deadline: cross-owner, atomic, and data-rewriting.

The scoped fix (enum value + default + idempotent migration + one-line gate
change + orders filter + `CPAY5`/`OV2` test updates) is estimated at half a day
including a full regression run, and is ready to be scheduled as post-submission
work. The site functions correctly today because the checkout flow proceeds to
payment immediately and `payment.payment_status` carries the true signal.

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

### BUG-10 — Unknown `?status=` filter value was silently ignored
**Severity:** Minor · **Area:** Admin · **Status:** Fixed 2026-07-28

`GET /api/admin/restaurants?status=banana` returned **200 with the full
unfiltered list** instead of rejecting the value, so a typo in a filter looked
like a successful query. Originally left open as an accepted contract.

**Fix:** [`admin_routes.py`](../BACKEND/routes/admin_routes.py) validates the
parameter before querying — any value outside `pending|approved|rejected`
(case-insensitive) → **422** naming the allowed values.

**Why this was safe to change this late, unlike BUG-06:** the change is
single-owner end to end — the route is admin code, and the only consumer of the
loose behaviour was `AR5` in the QA suite itself, inverted in the same change.
The frontend only ever sends valid values, so no deployed behaviour changes for
any real user.

**Verified 2026-07-28:** `AR5` now asserts the 422 and passes; full regression
green — 109/109 across the three suites (45 customer, 39 restaurant, 25 admin).

---

### BUG-11 — Result docs misspelled `_reselt`, breaking README links
**Severity:** Minor · **Area:** Documentation · **Status:** Fixed in `9754304`

Both result documents were named `..._reselt.md`, while the README linked them as
`..._result.md`. Both links were dead.

**Fix:** renamed via `git mv` (history preserved) and updated the one code
reference in the `test-admin-flow.py` docstring.

---

### BUG-12 — The payment page never sends the card fields; checkout always fails
**Severity:** Critical · **Area:** Frontend · **Status:** Closed 2026-07-28 — orphaned page removed

The defect was real; the impact claim was not. `Payment.jsx` did collect the
card fields and post only `subscription_id` + `amount`, and the 422 repro from
2026-07-25 was accurate. **Re-verification on 2026-07-28 found the page
unreachable**: nothing in the frontend navigated or linked to `/payment` — the
only reference was the route definition. The page was an orphan from an early
commit (`b232a81`, "Add Payment page"), superseded when checkout was built into
the order-summary page and never deleted.

The reachable flow (weekly selection → checkout) has sent the correct five-field
contract through the shared `authRequest` helper since at least `3ac3a03`
(2026-07-18) — a week before this report was compiled. *"No customer can
complete a payment through the UI"* was therefore **false when written**: the
broken request lived on a page no journey reached. Nor was the orphan fixable —
reached directly it has no subscription in its navigation state, so it could
only ever 422, over mock data and a "powered by Stripe" label naming the wrong
gateway.

**Fix:** the page was deleted rather than repaired — component, stylesheet,
route, and import — and the working page was renamed `OrderSummary` →
[`Checkout`](../FRONTEND/src/pages/Checkout/Checkout.jsx) (route `/checkout`) so
the file that takes the payment says so. Verified: no stale references, and
`vite build` passes.

**The original lesson stands, sharpened.** This entry blamed the API-only
suites: 109 green cases while checkout was "broken", because no suite drives the
frontend. Re-verification shows that gap cut both ways — the suites could not
show the page was broken, and inspection without the browser could not show the
page was unreachable. The report itself reviewed an orphaned file as if it were
the live flow. Both errors have the same fix: browser-level coverage of the
real journeys.

---

### BUG-13 — The payment page hardcodes `127.0.0.1`, bypassing the API base URL
**Severity:** Critical · **Area:** Frontend · **Status:** Closed 2026-07-28 — orphaned page removed

The hardcoded `fetch("http://127.0.0.1:8000/api/payments", …)` was real, but it
was in the same unreachable `Payment.jsx` as BUG-12, so no deployed user ever
hit it. The live checkout goes through `authRequest`, which builds URLs from
`VITE_API_BASE_URL` like the rest of the app. Closed by the same deletion;
`grep -rn "127.0.0.1:8000" FRONTEND/src/` now returns nothing.

The failure mode this entry warned about — a deployed build silently talking to
localhost — turned out to be real on the **backend** side instead: the Moyasar
callback URLs fall back to localhost and were undocumented. That is **BUG-14**.

---

### BUG-14 — Moyasar callback URLs undocumented; localhost fallbacks mask the gap
**Severity:** Critical · **Area:** Deployment / Payments · **Status:** Fixed — reclassified 2026-07-28

**The durable finding.** [`payment_routes.py`](../BACKEND/routes/payment_routes.py)
reads two environment variables that appeared in no `.env`, no `.env.example`,
and no README, both with localhost fallbacks:

| Variable | Fallback | Used for |
|---|---|---|
| `MOYASAR_CALLBACK_URL` | `http://127.0.0.1:8000/api/payments/callback` | Sent to Moyasar as the 3-D Secure return URL |
| `FRONTEND_BASE_URL` | `http://localhost:5173` | Where the callback then redirects the browser |

The fallbacks are exactly right locally, so every local run works — which is
what makes the gap invisible. If either variable is absent in a deployment,
3-D Secure returns the customer to their own machine and the payment stays
`pending` forever, with nothing in any dashboard or log to warn about it first.

**Correction to the original filing.** As filed, this entry claimed the
variables were unset on Railway and that deployed checkout was therefore broken
on its return leg. That claim was an **inference, not an observation** — it was
never directly checked against Railway's configuration. Both variables are in
fact present on Railway (added by a teammate; whether before or after this
entry was filed is not established). The deployed-impact claim is withdrawn as
unverified; what stands is the documentation gap. Second entry in this report
with a true code finding and an unsupported impact claim — see BUG-12 for the
first, and the same lesson applies.

**Fix, all parts verified 2026-07-28:**

* Both variables documented in [`.env.example`](../BACKEND/.env.example), with
  the deployment requirement stated explicitly.
* Railway values verified character-for-character: the callback URL matches the
  backend domain plus the exact route (`/api/payments` prefix + `/callback`),
  and the frontend URL matches the deployed Vercel origin with no trailing
  slash.
* `FRONTEND_BASE_URL` verified **behaviorally**: an unauthenticated GET to the
  deployed callback returns
  `307 → https://<frontend>/payment-result?status=error&message=Missing+payment+id`
  — the redirect leaves localhost only if the variable is set correctly.

**Verified against production 2026-07-29 — the full 3-D Secure round-trip.** A
manual sandbox-card checkout was performed by the QA lead on the deployed site
after the Railway variables were in place. The resulting records were then read
back independently through the admin API:

| Field | Value |
|---|---|
| Subscription | `#8`, created `2026-07-29 09:52`, SAR 250.00 |
| `payment_status` | **`success`** |
| `transaction_id` | present (Moyasar payment id) |
| `subscription.status` | `confirmed` |
| Order items | 5 — Sunday `2026-08-02` through Thursday `2026-08-06`, all `confirmed` |

**Why `payment_status = 'success'` is conclusive here.** That value is written
in exactly one place — the callback handler in
[`payment_routes.py`](../BACKEND/routes/payment_routes.py) — and only after it
re-fetches the payment from Moyasar server-to-server and sees `status = "paid"`.
For it to be `success` on the deployed database, Moyasar must have reached
`MOYASAR_CALLBACK_URL` on the deployed backend after a real 3-D Secure
authentication. The variable under test is therefore proven by the record, not
merely inspected. (Note that `subscription.status` alone would prove nothing —
per BUG-06 it is `'confirmed'` from creation; `payment_status` is the signal
that carries the money.)

This supersedes the earlier position that a deployed sandbox payment had been
skipped as low-residual-risk. The deployed loop is now verified end to end.

---

### BUG-15 — No discount codes are seeded; every code 404s in production
**Severity:** Major · **Area:** Payments / Seed data · **Status:** Fixed 2026-07-29

Found during manual verification of the deployed site: applying `SAVE10` at
checkout failed. It is not a code-path defect — **[`seed.sql`](../BACKEND/seed.sql)
contained no `INSERT INTO discount_code` at all**, so the deployed
`discount_code` table was empty and *every* code returned 404, not just this one.

**Repro** (against the deployed backend, before the fix):

```
POST /api/discount-codes/validate  {"code":"SAVE10"}
→ HTTP 404  {"detail":"Discount code does not exist."}
```

**Impact.** "Apply a discount code" is a **Should Have** user story in the Stage
3 documentation and was 100% non-functional in production. Not Critical —
checkout still completes at full price, so no customer is blocked from paying —
but the checkout page advertises the code in its own input placeholder
(`placeholder="e.g. SAVE10"` in
[`Checkout.jsx`](../FRONTEND/src/pages/Checkout/Checkout.jsx)), so the UI
actively invites the customer to enter a value that cannot work.

**Why every local environment looked healthy.** `SAVE10`, `SAVE25`,
`INACTIVE10` and `EXPIRED10` exist in developer databases because
[`test-customer-flow.py`](test-customer-flow.py) **inserts them as runtime
fixtures**. Anyone who had run the QA suite had a working `SAVE10`; anyone who
had only loaded the seed did not. A textbook "works on my machine" divergence,
and the reason this survived to production.

**Why the regression suite could not catch it.** The suite creates the fixture
and then asserts the endpoint validates it — proving the *code path* is
correct while never checking that the *seed* supplies what the *UI advertises*.
Structurally the same blind spot as BUG-12: the suite constructs its own world
and then verifies that world. Third instance in this report of a defect that
sat outside what the tests could see.

**Fix:** a `DISCOUNT CODES` block added to `seed.sql` inserting the two working
promotional codes (`SAVE10` 10%, `SAVE25` 25%), guarded by
`ON CONFLICT (code) DO NOTHING` so it is safe against databases that already
have them. The deliberately invalid fixtures (`INACTIVE10`, `EXPIRED10`)
were **not** added — they exist to prove rejection paths and belong to the QA
suites that assert on them, not to a demo environment.

**Verified in production 2026-07-29**, after applying the block to the Railway
database, by calling the deployed API directly:

| Request | Result |
|---|---|
| `SAVE10` | **200** — `discount_code_id: 1`, `10.00` |
| `save10` (lower-case) | **200** — resolves to `SAVE10`; the `UPPER(code)` lookup works |
| `SAVE25` | **200** — `25.00` |
| `NOTREAL` | **404** — the rejection path still behaves; the fix did not make validation permissive |

**Operational note.** Re-deploying does not re-run `seed.sql`, so an existing
deployed database needs the block applied once by hand:

```bash
psql "$RAILWAY_PUBLIC_DATABASE_URL" -c "INSERT INTO discount_code (code, discount_percentage, is_active, expires_at) VALUES ('SAVE10', 10.00, TRUE, NULL), ('SAVE25', 25.00, TRUE, NULL) ON CONFLICT (code) DO NOTHING;"
```

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
whether the pages actually work. BUG-12 made that gap concrete twice over: the
suites could not show the orphaned payment page was broken, and code inspection
without a browser could not show the page was unreachable. Browser-level
coverage of the three journeys is the obvious next investment.

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
* **The deployed database predates the current schema — corrected 2026-07-29.**
  An earlier draft of this section claimed the Railway database had been
  provisioned from the current `schema.sql`, "the first environment built
  without the discarded `review` table." That was inferred from the seeded data
  looking correct and was **never verified**. Inspecting the deployed database
  shows the vestigial `review` table is still present: the database was created
  before the reviews cleanup landed and has not been rebuilt since. Harmless —
  the table is empty and referenced by nothing — but it is a concrete instance
  of the pattern behind BUG-15: **an existing deployed database never picks up
  changes to `schema.sql` or `seed.sql`.** Those files describe how a *new*
  database is built; every deployed one drifts from them until it is explicitly
  migrated or rebuilt.

**What a green run here still does not cover.** Every check is an API call, so
this says nothing about whether the pages work — the same blind spot described
above, and the reason BUG-12 survived a fully green regression suite.

**Closed separately by a manual production checkout, 2026-07-29.** The QA lead
ran a sandbox-card payment through the deployed site end to end; the resulting
subscription (`#8`) carries `payment_status = 'success'` with a Moyasar
transaction id and 5 confirmed order items, read back independently through the
admin API. Because that payment status can only be written by the callback
after a server-to-server confirmation from Moyasar, the deployed checkout —
including the 3-D Secure return leg that BUG-14 concerned — is verified end to
end, not merely reachable. Combined with the browser-driven local run of
2026-07-28, both the customer journey and the deployed payment loop now have
direct evidence behind them.

The residual gap is narrower than before but real: **the deployed *pages* still
have no automated coverage.** Both end-to-end confirmations were performed by
hand, so they verify the product at a point in time rather than protecting it
from regression. Browser-level automation of the three journeys remains the
obvious next investment.
