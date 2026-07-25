"""
Production smoke check — Qooti Healthy Meals Platform.

Verifies that a deployed environment is up and behaving, without changing
anything in it. Safe to point at production; that is the whole purpose.

    # against a deployed API
    QOOTI_BASE_URL=https://qooti-api.onrender.com python3 smoke-check.py

    # against the local dev server (the default)
    python3 smoke-check.py

Deliberately different from the four end-to-end suites in this directory:

  * **Strictly read-only.** Only GETs, plus two POSTs that cannot write —
    a login with credentials that do not exist (expected 401) and, if
    credentials are supplied, one real login. No registrations, no
    subscriptions, no payments, no schema changes.
  * **No database connection.** Everything is asserted through the public API,
    so this needs no production database credentials and no psycopg2.
  * **No third-party packages.** Standard library only, so it runs on any
    machine with Python 3 — a laptop, CI, a deploy hook — with nothing to
    install first. (The other four suites need the backend venv.)
  * **No QOOTI_ALLOW_REMOTE opt-in**, because there is nothing to protect
    against: the worst case is a few log lines on the server.

Optional authenticated leg: set QOOTI_SMOKE_EMAIL and QOOTI_SMOKE_PASSWORD to
verify that a real login round-trips and returns the right profile. Use a
dedicated read-only QA account, never a real customer's. Without them those
checks report SKIP and the run can still pass.

Exit codes: 0 = everything passed, 1 = at least one check failed.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE_URL = os.getenv("QOOTI_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
FRONTEND_ORIGIN = os.getenv("QOOTI_FRONTEND_ORIGIN")
SMOKE_EMAIL = os.getenv("QOOTI_SMOKE_EMAIL")
SMOKE_PASSWORD = os.getenv("QOOTI_SMOKE_PASSWORD")

TIMEOUT = 15
SLOW_MS = 2000  # a slower response is called out, but is not a failure

NUTRITION_FIELDS = ["calories", "protein_g", "carbs_g", "fats_g", "tags"]

results = []


def check(case_id, name, condition, detail=""):
    results.append((case_id, name, "pass" if condition else "fail", detail))
    print(f"[{'PASS' if condition else 'FAIL'}] {case_id}: {name}"
          f"{(' — ' + detail) if detail else ''}")


def skip(case_id, name, why):
    results.append((case_id, name, "skip", why))
    print(f"[SKIP] {case_id}: {name} — {why}")


class Response:
    """A finished HTTP exchange. `status` is None if the host was unreachable."""

    def __init__(self, status, body=b"", headers=None, error=None):
        self.status = status
        self.body = body
        # Lower-cased keys — header casing is at the server's discretion.
        self.headers = {k.lower(): v for k, v in (headers or {}).items()}
        self.error = error

    def json(self):
        """Parsed body, or None — a broken deploy may return HTML or nothing."""
        try:
            return json.loads(self.body)
        except (ValueError, TypeError):
            return None

    @property
    def text(self):
        return self.body.decode("utf-8", "replace")


def request(method, path, headers=None, payload=None):
    """Perform one request, turning every failure mode into a Response."""
    data = json.dumps(payload).encode() if payload is not None else None
    hdrs = {"Accept": "application/json"}
    if data is not None:
        hdrs["Content-Type"] = "application/json"
    hdrs.update(headers or {})

    req = urllib.request.Request(f"{BASE_URL}{path}", data=data,
                                 headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return Response(resp.status, resp.read(), dict(resp.headers))
    except urllib.error.HTTPError as e:
        # A 4xx/5xx is a real answer from the service, not a failure to reach it.
        return Response(e.code, e.read(), dict(e.headers))
    except Exception as e:
        return Response(None, error=f"{type(e).__name__}: {str(e)[:120]}")


def get(path, headers=None):
    return request("GET", path, headers=headers)


def post(path, payload, headers=None):
    return request("POST", path, headers=headers, payload=payload)


def test_reachable():
    print("\n=== Service is up ===")

    start = time.monotonic()
    r = get("/health")
    elapsed_ms = int((time.monotonic() - start) * 1000)

    if r.status is None:
        check("HLT1", f"{BASE_URL} is reachable", False, r.error)
        print("\nHost unreachable — skipping the remaining checks.")
        return False

    body = r.json()
    check("HLT1", "GET /health → 200 healthy",
          r.status == 200 and body and body.get("status") == "healthy",
          f"status={r.status} in {elapsed_ms}ms")

    if elapsed_ms > SLOW_MS:
        print(f"       note: health check took {elapsed_ms}ms "
              f"(over {SLOW_MS}ms — cold start or an undersized instance?)")

    r = get("/")
    body = r.json()
    check("HLT2", "GET / → 200 with the API version",
          r.status == 200 and body and body.get("version"),
          f"status={r.status} version={body.get('version') if body else None}")

    return True


def test_public_browsing():
    print("\n=== Public browsing (what a logged-out visitor sees) ===")

    r = get("/api/restaurants")
    restaurants = r.json()
    listed = isinstance(restaurants, list)
    check("PUB1", "GET /api/restaurants → 200 with a JSON list",
          r.status == 200 and listed,
          f"status={r.status} count={len(restaurants) if listed else 'n/a'}")

    if not listed or not restaurants:
        for case, name in [("PUB2", "listed restaurants are all approved"),
                           ("PUB3", "restaurant detail resolves"),
                           ("PUB4", "meals carry full nutrition")]:
            skip(case, name, "no restaurants returned")
        return

    # The public list must never expose an unapproved restaurant. Sample the
    # first few rather than every row, to stay quick on a large catalogue.
    sample = restaurants[:5]
    unapproved = []
    for item in sample:
        detail = get(f"/api/restaurants/{item['restaurant_id']}").json()
        if not detail or detail.get("is_verified") is not True:
            unapproved.append(item["restaurant_id"])
    check("PUB2", f"all {len(sample)} sampled restaurants are approved",
          not unapproved,
          "none unapproved" if not unapproved else f"LEAKED into the public list: {unapproved}")

    first = restaurants[0]["restaurant_id"]
    r = get(f"/api/restaurants/{first}")
    detail = r.json()
    check("PUB3", "restaurant detail → 200 with a name",
          r.status == 200 and detail and detail.get("restaurant_name"),
          f"status={r.status}")

    r = get(f"/api/restaurants/{first}/meals")
    meals = (r.json() or {}).get("meals", [])
    if not meals:
        skip("PUB4", "meals carry full nutrition",
             f"restaurant {first} has no meals published")
    else:
        missing = [f for f in NUTRITION_FIELDS if f not in meals[0]]
        check("PUB4", "meals list → 200 and every card has full nutrition",
              r.status == 200 and not missing, f"status={r.status} missing={missing}")

    r = get("/api/restaurants/999999")
    body = r.json()
    check("PUB5", "unknown restaurant → clean 404 JSON, not a 500 or a stack trace",
          r.status == 404 and body is not None and "detail" in body,
          f"status={r.status}")


def test_auth_enforcement():
    print("\n=== Auth enforcement (no credentials needed) ===")

    r = get("/api/users/me")
    check("SEC1", "profile without a token → 401", r.status == 401, f"status={r.status}")

    r = get("/api/admin/overview")
    check("SEC2", "admin dashboard without a token → 401", r.status == 401,
          f"status={r.status}")

    r = get("/api/admin/overview", headers={"Authorization": "Bearer not.a.real.token"})
    check("SEC3", "admin dashboard with a forged token → 401", r.status == 401,
          f"status={r.status}")

    r = get("/api/restaurants/me")
    check("SEC4", "restaurant profile without a token → 401", r.status == 401,
          f"status={r.status}")

    # Read-only: this account does not exist, so nothing is created or locked out.
    r = post("/api/auth/login", {"email": "smoke.check.nobody@example.invalid",
                                 "password": "not-a-password"})
    check("SEC5", "login with credentials that do not exist → 401", r.status == 401,
          f"status={r.status}")

    leaked = [w for w in ("Traceback", "psycopg2", "postgresql://", "SECRET_KEY")
              if w.lower() in r.text.lower()]
    check("SEC6", "failed login reveals nothing about the internals",
          not leaked, f"leaked={leaked}")


def test_cors():
    print("\n=== CORS ===")

    if not FRONTEND_ORIGIN:
        skip("CORS1", "frontend origin is allowed",
             "set QOOTI_FRONTEND_ORIGIN to the deployed frontend URL to check this")
        return

    r = request("OPTIONS", "/api/restaurants", headers={
        "Origin": FRONTEND_ORIGIN,
        "Access-Control-Request-Method": "GET",
    })
    if r.status is None:
        check("CORS1", f"preflight allows {FRONTEND_ORIGIN}", False, r.error)
        return

    allowed = r.headers.get("access-control-allow-origin", "")
    check("CORS1", f"preflight allows {FRONTEND_ORIGIN}",
          allowed in (FRONTEND_ORIGIN, "*"),
          f"status={r.status} allow-origin={allowed or 'absent'}")


def test_authenticated():
    print("\n=== Authenticated round-trip (optional) ===")

    cases = [("USR1", "login returns a token"),
             ("USR2", "token opens the profile endpoint"),
             ("USR3", "profile matches the account that logged in")]

    if not (SMOKE_EMAIL and SMOKE_PASSWORD):
        for case, name in cases:
            skip(case, name, "set QOOTI_SMOKE_EMAIL and QOOTI_SMOKE_PASSWORD to enable")
        return

    r = post("/api/auth/login", {"email": SMOKE_EMAIL, "password": SMOKE_PASSWORD})
    token = (r.json() or {}).get("access_token")
    check("USR1", "login returns a token", r.status == 200 and bool(token),
          f"status={r.status}")

    if not token:
        for case, name in cases[1:]:
            skip(case, name, "no token to test with")
        return

    r = get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    profile = r.json() or {}
    profile = profile.get("user", profile)
    check("USR2", "token opens the profile endpoint", r.status == 200,
          f"status={r.status}")

    check("USR3", "profile matches the account that logged in",
          profile.get("email") == SMOKE_EMAIL,
          f"matches={profile.get('email') == SMOKE_EMAIL}")


def main():
    print(f"Smoke-checking {BASE_URL}")

    if test_reachable():
        test_public_browsing()
        test_auth_enforcement()
        test_cors()
        test_authenticated()

    passed = sum(1 for r in results if r[2] == "pass")
    failed = sum(1 for r in results if r[2] == "fail")
    skipped = sum(1 for r in results if r[2] == "skip")

    print("\n" + "=" * 50)
    print(f"Total: {len(results)}  Passed: {passed}  Failed: {failed}  Skipped: {skipped}")
    if failed:
        print("\nFailed checks:")
        for case_id, name, outcome, detail in results:
            if outcome == "fail":
                print(f"  {case_id}: {name} — {detail}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
