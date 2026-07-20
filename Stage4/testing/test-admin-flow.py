"""
Admin-flow test suite — Qooti Healthy Meals Platform.

Run with the backend venv (has requests + psycopg2) while the server is up:

    cd BACKEND/project/backend
    .venv/bin/python -m uvicorn main:app                     # terminal 1
    .venv/bin/python ../../../testing/test-admin-flow.py     # terminal 2

Covers the admin panel end-to-end (automating the previously manual
AR/AP cases from test-cases-restaurants-meals_reselt.md, plus the
dashboard endpoints):
  Auth       — admin-only enforcement on /api/admin/* (401/403)
  Overview   — GET /api/admin/overview counts vs. the database
  Customers  — GET /api/admin/customers lists clients only
  Orders     — GET /api/admin/orders lists subscriptions with user info
  Listing    — GET /api/admin/restaurants?status=… filters + /pending route
  Approval   — PATCH /api/admin/restaurants/:id/status transitions and
               validation (reject needs reason, approve forbids one, enum
               enforcement, 404, idempotent re-approve)

Idempotent across runs: dedicated QA restaurants are reset to pending at
start. Requires only the local server + PostgreSQL (no internet access).
"""

import sys
from pathlib import Path

import psycopg2
import requests
from psycopg2.extras import RealDictCursor

BASE_URL = "http://127.0.0.1:8000"

# Read DB credentials from the backend .env (DATABASE_URL)
ENV_FILE = Path(__file__).resolve().parents[1] / "BACKEND" / "project" / "backend" / ".env"
DATABASE_URL = None
for line in ENV_FILE.read_text().splitlines():
    if line.strip().startswith("DATABASE_URL="):
        DATABASE_URL = line.split("=", 1)[1].strip()
if not DATABASE_URL:
    sys.exit("DATABASE_URL not found in backend .env")

# Admin emails must be on @qooti_admin.com (DB chk_admin_email_domain)
ADMIN = {"email": "qa.adminflow.admin@qooti_admin.com", "password": "Passw0rd!"}
CLIENT = {"email": "qa.adminflow.client@example.com", "password": "Passw0rd!"}
REST_C = {"email": "qa.adminflow.rest.c@example.com", "password": "Passw0rd!"}  # → approved
REST_D = {"email": "qa.adminflow.rest.d@example.com", "password": "Passw0rd!"}  # → rejected
REST_E = {"email": "qa.adminflow.rest.e@example.com", "password": "Passw0rd!"}  # stays pending

SUB = {"start_date": "2026-07-15", "end_date": "2026-07-21", "delivery_time": "09:00"}

results = []


def check(case_id, name, condition, detail=""):
    results.append((case_id, name, bool(condition), detail))
    mark = "PASS" if condition else "FAIL"
    print(f"[{mark}] {case_id}: {name} {('— ' + detail) if detail else ''}")


def db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def db_one(query, params=None):
    with db() as conn, conn.cursor() as cur:
        cur.execute(query, params or ())
        return cur.fetchone()


def db_exec(query, params=None):
    with db() as conn, conn.cursor() as cur:
        cur.execute(query, params or ())
        conn.commit()


def register(user_type, email, password, **extra):
    payload = {
        "user_type": user_type,
        "full_name": f"QA {user_type} {email.split('@')[0]}",
        "email": email,
        "password": password,
        "phone": "+966500000000",
        **extra,
    }
    requests.post(f"{BASE_URL}/api/auth/register", json=payload)  # 400 if exists — fine


def login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def admin_restaurants(headers, status=None):
    params = {"status": status} if status else None
    return requests.get(f"{BASE_URL}/api/admin/restaurants", params=params, headers=headers)


def set_status(headers, restaurant_id, **body):
    return requests.patch(f"{BASE_URL}/api/admin/restaurants/{restaurant_id}/status",
                          json=body, headers=headers)


def ids_of(response):
    return [x["restaurant_id"] for x in response.json()]


def restaurant_id_by_email(email):
    return db_one("""
        SELECT r.restaurant_id FROM restaurant r
        JOIN app_user u USING (user_id) WHERE u.email = %s;
    """, (email,))["restaurant_id"]


def setup():
    client_fields = dict(age=30, gender="female", height_cm=165.0, weight_kg=60.0,
                         health_goal="maintain", address="Riyadh, KSA")
    register("client", CLIENT["email"], CLIENT["password"], **client_fields)
    register("admin", ADMIN["email"], ADMIN["password"])
    for i, rest in enumerate([REST_C, REST_D, REST_E]):
        register("restaurant", rest["email"], rest["password"],
                 restaurant_name=f"QA Admin Kitchen {'CDE'[i]}",
                 description="QA admin-flow restaurant")

    # Reset the QA restaurants to pending so approval flows are
    # deterministic on every run.
    db_exec("""
        UPDATE restaurant SET is_verified = FALSE, rejection_reason = NULL
        WHERE user_id IN (SELECT user_id FROM app_user WHERE email IN (%s, %s, %s));
    """, (REST_C["email"], REST_D["email"], REST_E["email"]))


def test_auth_enforcement(client, rest_c):
    print("\n=== Admin auth & role enforcement ===")

    r = requests.get(f"{BASE_URL}/api/admin/overview")
    check("AD1", "no auth token on /admin/overview → 401", r.status_code == 401,
          f"status={r.status_code}")

    r = requests.get(f"{BASE_URL}/api/admin/overview", headers=client)
    check("AD2", "client token on /admin/overview → 403", r.status_code == 403,
          f"status={r.status_code}")

    r = requests.get(f"{BASE_URL}/api/admin/customers", headers=rest_c)
    check("AD3", "restaurant token on /admin/customers → 403", r.status_code == 403,
          f"status={r.status_code}")


def test_overview(admin):
    print("\n=== Admin overview dashboard ===")

    r = requests.get(f"{BASE_URL}/api/admin/overview", headers=admin)
    body = r.json()
    fields = ["total_restaurants", "pending_restaurants", "total_customers", "total_orders"]
    check("OV1", "overview → 200 with the four count fields",
          r.status_code == 200 and all(isinstance(body.get(f), int) for f in fields),
          f"status={r.status_code} body={body}")

    truth = db_one("""
        SELECT
            (SELECT COUNT(*) FROM restaurant) AS total_restaurants,
            (SELECT COUNT(*) FROM restaurant
             WHERE is_verified = FALSE AND rejection_reason IS NULL) AS pending_restaurants,
            (SELECT COUNT(*) FROM app_user WHERE user_type = 'client') AS total_customers,
            (SELECT COUNT(*) FROM subscription) AS total_orders;
    """)
    check("OV2", "overview counts match the database",
          all(body[f] == truth[f] for f in fields),
          f"api={body} db={dict(truth)}")


def test_customers(admin):
    print("\n=== Admin customers list ===")

    r = requests.get(f"{BASE_URL}/api/admin/customers", headers=admin)
    customers = r.json().get("customers", [])
    ours = [c for c in customers if c["email"] == CLIENT["email"]]
    check("CU1", "customers list → 200 and includes the QA client with profile fields",
          r.status_code == 200 and len(ours) == 1
          and all(k in ours[0] for k in ["user_id", "full_name", "phone", "created_at", "is_active"]),
          f"status={r.status_code} found={len(ours)}")

    emails = {c["email"] for c in customers}
    non_clients = emails & {ADMIN["email"], REST_C["email"], REST_D["email"], REST_E["email"]}
    check("CU2", "customers list contains clients only (no admin/restaurant users)",
          non_clients == set(), f"leaked={non_clients}")


def test_orders(admin, client):
    print("\n=== Admin orders list ===")

    sub_id = requests.post(f"{BASE_URL}/api/subscriptions", json=SUB,
                           headers=client).json()["subscription_id"]

    r = requests.get(f"{BASE_URL}/api/admin/orders", headers=admin)
    orders = r.json().get("orders", [])
    ours = [o for o in orders if o["subscription_id"] == sub_id]
    check("OR1", "orders list → 200 and includes the new QA subscription",
          r.status_code == 200 and len(ours) == 1, f"status={r.status_code} found={len(ours)}")

    o = ours[0] if ours else {}
    check("OR2", "order row carries user info, pricing, and status",
          o.get("email") == CLIENT["email"] and o.get("final_price") is not None
          and o.get("status") == "confirmed",
          f"email={o.get('email')} price={o.get('final_price')} status={o.get('status')}")


def test_listing_filters(admin, c_id, d_id, e_id):
    print("\n=== Admin restaurant listing & filters ===")

    r = admin_restaurants(admin, "pending")
    pending = ids_of(r)
    check("AR1", "?status=pending lists the reset QA restaurants",
          r.status_code == 200 and {c_id, d_id, e_id} <= set(pending),
          f"status={r.status_code} pending={pending}")

    r = admin_restaurants(admin)
    check("AR2", "no filter lists all restaurants (superset of pending)",
          r.status_code == 200 and {c_id, d_id, e_id} <= set(ids_of(r)),
          f"status={r.status_code} count={len(ids_of(r))}")

    set_status(admin, c_id, status="approved")
    set_status(admin, d_id, status="rejected", rejection_reason="QA: incomplete papers")

    approved = ids_of(admin_restaurants(admin, "approved"))
    check("AR3", "?status=approved includes approved, excludes rejected/pending",
          c_id in approved and d_id not in approved and e_id not in approved,
          f"approved={approved}")

    rejected = ids_of(admin_restaurants(admin, "rejected"))
    check("AR4", "?status=rejected includes rejected, excludes approved/pending",
          d_id in rejected and c_id not in rejected and e_id not in rejected,
          f"rejected={rejected}")

    r = admin_restaurants(admin, "banana")
    all_ids = ids_of(admin_restaurants(admin))
    check("AR5", "unknown filter value is ignored → 200 all (documented contract)",
          r.status_code == 200 and set(ids_of(r)) == set(all_ids),
          f"status={r.status_code}")

    r = requests.get(f"{BASE_URL}/api/admin/restaurants/pending", headers=admin)
    dedicated = ids_of(r)
    check("AR6", "dedicated /pending route matches ?status=pending",
          r.status_code == 200 and e_id in dedicated
          and c_id not in dedicated and d_id not in dedicated,
          f"pending={dedicated}")

    d_row = next(x for x in admin_restaurants(admin, "rejected").json()
                 if x["restaurant_id"] == d_id)
    check("AR7", "admin listing exposes rejection_reason (unlike public API)",
          d_row.get("rejection_reason") == "QA: incomplete papers",
          f"reason={d_row.get('rejection_reason')}")


def test_approval_validation(admin, client, c_id, e_id):
    print("\n=== Approve / reject validation ===")

    row = db_one("SELECT is_verified, rejection_reason FROM restaurant WHERE restaurant_id = %s;",
                 (c_id,))
    check("AP1", "approve → is_verified TRUE, reason NULL in DB",
          row["is_verified"] is True and row["rejection_reason"] is None, f"db={dict(row)}")

    listed = [x["restaurant_id"] for x in requests.get(f"{BASE_URL}/api/restaurants").json()]
    check("AP2", "approved restaurant appears in the public list", c_id in listed,
          f"in_list={c_id in listed}")

    r = set_status(admin, e_id, status="rejected")
    row = db_one("SELECT is_verified, rejection_reason FROM restaurant WHERE restaurant_id = %s;",
                 (e_id,))
    check("AP3", "reject without reason → 400, row stays pending",
          r.status_code == 400 and row["is_verified"] is False
          and row["rejection_reason"] is None,
          f"status={r.status_code} db={dict(row)}")

    r = set_status(admin, e_id, status="approved", rejection_reason="should not be here")
    check("AP4", "approve with rejection_reason present → 400", r.status_code == 400,
          f"status={r.status_code}")

    r = set_status(admin, e_id, status="maybe")
    check("AP5", "invalid status value → 422 (enum enforced)", r.status_code == 422,
          f"status={r.status_code}")

    r = set_status(admin, 999999, status="approved")
    check("AP6", "non-existent restaurant → 404", r.status_code == 404,
          f"status={r.status_code}")

    r = set_status(admin, c_id, status="approved")
    row = db_one("SELECT is_verified FROM restaurant WHERE restaurant_id = %s;", (c_id,))
    check("AP7", "re-approve already-approved → idempotent 200",
          r.status_code == 200 and row["is_verified"] is True, f"status={r.status_code}")

    r = set_status(client, e_id, status="approved")
    check("AP8", "non-admin PATCH → 403", r.status_code == 403, f"status={r.status_code}")

    r = set_status({}, e_id, status="approved")
    check("AP9", "no auth PATCH → 401", r.status_code == 401, f"status={r.status_code}")


def main():
    setup()
    admin = login(ADMIN)
    client = login(CLIENT)
    rest_c = login(REST_C)

    c_id = restaurant_id_by_email(REST_C["email"])
    d_id = restaurant_id_by_email(REST_D["email"])
    e_id = restaurant_id_by_email(REST_E["email"])

    test_auth_enforcement(client, rest_c)
    test_overview(admin)
    test_customers(admin)
    test_orders(admin, client)
    test_listing_filters(admin, c_id, d_id, e_id)
    test_approval_validation(admin, client, c_id, e_id)

    passed = sum(1 for _, _, ok, _ in results if ok)
    failed = len(results) - passed
    print("\n" + "=" * 50)
    print(f"Total: {len(results)}  Passed: {passed}  Failed: {failed}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
