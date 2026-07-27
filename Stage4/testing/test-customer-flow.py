"""
Customer-flow test suite — Qooti Healthy Meals Platform.

Run with the backend venv (has requests + psycopg2) while the server is up:

    cd BACKEND
    .venv/bin/python -m uvicorn main:app                   # terminal 1
    .venv/bin/python ../testing/test-customer-flow.py      # terminal 2

Walks the Sprint 4 customer journey end-to-end, in order:
  Register   — POST /api/auth/register with real assertions on the response
               and the app_user row (automating the manual R-cases from
               test-cases-registration-login.md)
  Login      — POST /api/auth/login: token issuance, rejection of bad
               credentials, and the token actually opening a protected route
  Browse     — public restaurant list/detail + meals with full nutrition
  Select     — validate a discount code, create the subscription, then save
               one meal per day for the Sunday–Thursday week
  Pay        — POST /api/payments → Moyasar sandbox 3D Secure → callback,
               and the payment row flipping to 'success'
  Dashboard  — the customer sees the finished order in their subscription
               history and weekly schedule

Unlike the other suites this one *asserts* on registration and login rather
than using them as silent setup, so a broken signup fails here loudly instead
of surfacing later as a confusing 401.

Idempotent across runs: the journey customer is deleted and re-registered
every run, so REG1 is always a genuine first-time signup.

Extra requirements (the 'pay' leg is a real Moyasar sandbox transaction):
MOYASAR_SECRET_KEY in the backend .env, internet access, and the frontend dev
server on :5173 (the payment callback redirects there).
"""

import os
import re
import sys
import time
from datetime import date
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urljoin, urlparse

import psycopg2
import requests
from psycopg2.extras import RealDictCursor

# Which deployment to test. Defaults to the local dev server; set
# QOOTI_BASE_URL to point at staging or production.
BASE_URL = os.getenv("QOOTI_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

# DB credentials come from the backend .env unless QOOTI_DATABASE_URL overrides
# them — a remote BASE_URL needs the matching remote database, or the
# assertions would be checking the wrong rows.
DATABASE_URL = os.getenv("QOOTI_DATABASE_URL")
if not DATABASE_URL:
    ENV_FILE = Path(__file__).resolve().parents[1] / "BACKEND" / ".env"
    for line in ENV_FILE.read_text().splitlines():
        if line.strip().startswith("DATABASE_URL="):
            DATABASE_URL = line.split("=", 1)[1].strip()
if not DATABASE_URL:
    sys.exit("No database URL: set QOOTI_DATABASE_URL, or DATABASE_URL in the backend .env")

# These suites are not read-only — they register users, edit restaurant rows,
# and (in the payments suite) install fault-injection triggers. Pointing them
# at a shared or live environment has to be a deliberate act, not a typo.
if not BASE_URL.startswith(("http://127.0.0.1", "http://localhost", "http://[::1]")) \
        and os.getenv("QOOTI_ALLOW_REMOTE") != "1":
    sys.exit(f"Refusing to run against {BASE_URL}: these suites write to the target "
             "database. Re-run with QOOTI_ALLOW_REMOTE=1 if that is intended.")

# Values for the device-fingerprint form on Moyasar's 3DS prepare page
# (normally filled in by browser JavaScript)
DEVICE_INFO = {
    "color_depth": "24",
    "js_enabled": "true",
    "language": "en-US",
    "screen_height": "1080",
    "screen_width": "1920",
    "time_zone": "-180",
}


def complete_3ds(transaction_url, auth_result="AUTHENTICATED"):
    """
    Walk Moyasar's test-mode 3D Secure pages the way a browser would:
    prepare → authenticate (device info) → acs_emulator → set_auth_result
    → acs_return. Each page is a form that browser JS would auto-submit;
    we parse and submit them ourselves, keeping the session cookies.
    """
    session = requests.Session()
    response = session.get(transaction_url, timeout=20)

    for _ in range(8):
        form = re.search(r'<form[^>]*action="([^"]*)"[^>]*>(.*?)</form>', response.text, re.S)
        if not form:
            break

        action = urljoin(response.url, form.group(1))
        fields = {}
        for input_tag in re.findall(r"<input[^>]*>", form.group(2)):
            name = re.search(r'name="([^"]*)"', input_tag)
            if not name or name.group(1) in ("", "submit"):
                continue
            value = re.search(r'value="([^"]*)"', input_tag)
            fields[name.group(1)] = value.group(1) if value else DEVICE_INFO.get(name.group(1), "")

        if 'name="auth_result"' in form.group(2):
            fields["auth_result"] = auth_result

        response = session.post(action, data=fields, timeout=20)

        if action.endswith("/acs_return"):
            return True

    return False

# The journey customer — purged and re-registered on every run.
CLIENT = {"email": "qa.cust.client@example.com", "password": "Passw0rd!"}
# A second customer, only used to prove one customer cannot read another's order.
OTHER = {"email": "qa.cust.other@example.com", "password": "Passw0rd!"}
REST = {"email": "qa.cust.rest@example.com", "password": "Passw0rd!"}
# Admin emails must be on @qooti-admin.com (DB chk_admin_email_domain)
ADMIN = {"email": "qa.cust.admin@qooti-admin.com", "password": "Passw0rd!"}

PROFILE = dict(age=28, gender="female", height_cm=168.0, weight_kg=62.0,
               health_goal="lose_weight", address="King Fahd Rd, Riyadh, KSA")

# Window 2026-07-15 (Wed) → 2026-07-21 (Tue). day_of_week only covers
# Sunday–Thursday (Saudi work week), so the selectable days inside the
# window are Wed 15, Thu 16, Sun 19, Mon 20, Tue 21 — a full five-day week.
SUB = {"start_date": "2026-07-15", "end_date": "2026-07-21", "delivery_time": "08:30"}
WEEK_DAYS = ["2026-07-15", "2026-07-16", "2026-07-19", "2026-07-20", "2026-07-21"]

BASE_PRICE = Decimal("250.00")

# Moyasar sandbox test card (never charged for real)
VALID_CARD = {
    "card_number": "4111111111111111",
    "card_expiry_month": 12,
    "card_expiry_year": 2030,
    "card_cvc": "123",
    "card_holder_name": "QA Test User",
}

MEAL_TEMPLATE = {
    "description": "QA customer-flow meal",
    "ingredients": "chicken breast, quinoa, spinach, olive oil",
    "calories": 510,
    "protein_g": 40.0,
    "carbs_g": 48.0,
    "fats_g": 14.0,
    "image_url": "https://example.com/qa-customer-meal.jpg",
    "tags": ["high-protein", "low-carb"],
}
MEAL_NAMES = ["QA Customer Bowl 1", "QA Customer Bowl 2", "QA Customer Bowl 3"]

NUTRITION_FIELDS = ["calories", "protein_g", "carbs_g", "fats_g", "ingredients", "tags"]

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


def db_all(query, params=None):
    with db() as conn, conn.cursor() as cur:
        cur.execute(query, params or ())
        return cur.fetchall()


def db_exec(query, params=None):
    with db() as conn, conn.cursor() as cur:
        cur.execute(query, params or ())
        conn.commit()


def register_payload(user_type, email, password, **extra):
    return {
        "user_type": user_type,
        "full_name": f"QA {user_type} {email.split('@')[0]}",
        "email": email,
        "password": password,
        "phone": "+966500000000",
        **extra,
    }


def register(user_type, email, password, **extra):
    return requests.post(f"{BASE_URL}/api/auth/register",
                         json=register_payload(user_type, email, password, **extra))


def login_raw(creds):
    return requests.post(f"{BASE_URL}/api/auth/login", json=creds)


def login(creds):
    r = login_raw(creds)
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def meal_id_from(response):
    m = re.search(r"Meal ID: (\d+)", response.json().get("message", ""))
    return int(m.group(1)) if m else None


def sel(meal_id, day_date):
    d = date.fromisoformat(day_date)
    return {"meal_id": meal_id, "day_date": day_date, "day_of_week": d.strftime("%A")}


def callback(moyasar_payment_id):
    """Hit the callback endpoint the way Moyasar's browser redirect would."""
    r = requests.get(f"{BASE_URL}/api/payments/callback", params={"id": moyasar_payment_id})
    landed = urlparse(r.url)
    params = {k: v[0] for k, v in parse_qs(landed.query).items()}
    return SimpleNamespace(
        on_result_page=r.status_code == 200 and landed.path == "/payment-result",
        status=params.get("status"),
        message=params.get("message", ""),
    )


def purge_customer(email):
    """Delete a customer and everything hanging off them.

    Every FK in the schema is ON DELETE RESTRICT, so children go first:
    order_item → payment → subscription → app_user.
    """
    user = db_one("SELECT user_id FROM app_user WHERE email = %s;", (email,))
    if not user:
        return
    uid = user["user_id"]
    db_exec("""
        DELETE FROM order_item WHERE subscription_id IN (
            SELECT subscription_id FROM subscription WHERE user_id = %s);
    """, (uid,))
    db_exec("""
        DELETE FROM payment WHERE subscription_id IN (
            SELECT subscription_id FROM subscription WHERE user_id = %s);
    """, (uid,))
    db_exec("DELETE FROM subscription WHERE user_id = %s;", (uid,))
    db_exec("DELETE FROM app_user WHERE user_id = %s;", (uid,))


def ensure_meals(rest_headers, restaurant_id):
    """Return the QA meal ids for this restaurant, creating any that are missing."""
    meal_ids = []
    for name in MEAL_NAMES:
        row = db_one("""
            SELECT meal_id FROM meal
            WHERE restaurant_id = %s AND name = %s AND is_available = TRUE;
        """, (restaurant_id, name))
        if row:
            meal_ids.append(row["meal_id"])
            continue
        r = requests.post(f"{BASE_URL}/api/meals",
                          json={**MEAL_TEMPLATE, "restaurant_id": restaurant_id, "name": name},
                          headers=rest_headers)
        meal_ids.append(meal_id_from(r))
    return meal_ids


def setup():
    """Seed the supporting cast; the journey customer is deliberately absent."""
    purge_customer(CLIENT["email"])

    register("client", OTHER["email"], OTHER["password"], **PROFILE)
    register("admin", ADMIN["email"], ADMIN["password"])
    register("restaurant", REST["email"], REST["password"],
             restaurant_name="QA Customer Kitchen",
             description="QA customer-flow restaurant")

    # The customer can only browse approved restaurants, so approve ours.
    admin = login(ADMIN)
    rest = login(REST)
    rest_id = requests.get(f"{BASE_URL}/api/restaurants/me",
                           headers=rest).json()["restaurant"]["restaurant_id"]
    requests.patch(f"{BASE_URL}/api/admin/restaurants/{rest_id}/status",
                   json={"status": "approved"}, headers=admin)

    db_exec("""
        INSERT INTO discount_code (code, discount_percentage) VALUES ('SAVE10', 10.00)
        ON CONFLICT (code) DO NOTHING;
    """)

    return rest_id, ensure_meals(rest, rest_id)


def test_registration():
    print("\n=== Customer registration ===")

    r = register("client", CLIENT["email"], CLIENT["password"], **PROFILE)
    body = r.json() if r.status_code == 200 else {}
    check("REG1", "valid client registration → 200 + user_id",
          r.status_code == 200 and isinstance(body.get("user_id"), int),
          f"status={r.status_code} body={body}")

    row = db_one("""
        SELECT user_type, full_name, phone, age, gender, height_cm, weight_kg,
               health_goal, address, is_active, password_hash
        FROM app_user WHERE email = %s;
    """, (CLIENT["email"],))
    check("REG2", "app_user row created as an active client",
          row and row["user_type"] == "client" and row["is_active"] is True,
          f"type={row and row['user_type']} active={row and row['is_active']}")

    check("REG3", "health profile and address persisted exactly as submitted",
          row and row["age"] == PROFILE["age"] and row["gender"] == PROFILE["gender"]
          and float(row["height_cm"]) == PROFILE["height_cm"]
          and float(row["weight_kg"]) == PROFILE["weight_kg"]
          and row["health_goal"] == PROFILE["health_goal"]
          and row["address"] == PROFILE["address"],
          f"db={ {k: row[k] for k in ('age', 'gender', 'health_goal')} if row else None }")

    check("REG4", "password stored hashed, never in plaintext",
          row and row["password_hash"] != CLIENT["password"]
          and row["password_hash"].startswith("$argon2"),
          f"algo={row['password_hash'][:9] if row else None}")

    r = register("client", CLIENT["email"], CLIENT["password"], **PROFILE)
    count = db_one("SELECT COUNT(*) AS n FROM app_user WHERE email = %s;",
                   (CLIENT["email"],))["n"]
    check("REG5", "duplicate email → 400 and no second row",
          r.status_code == 400 and count == 1, f"status={r.status_code} rows={count}")

    r = register("client", "not-an-email", CLIENT["password"], **PROFILE)
    check("REG6", "invalid email format → 422", r.status_code == 422, f"status={r.status_code}")

    r = register("client", "qa.cust.weak@example.com", "short", **PROFILE)
    exists = db_one("SELECT 1 FROM app_user WHERE email = %s;", ("qa.cust.weak@example.com",))
    check("REG7", "password under 8 chars → 422 and no row created",
          r.status_code == 422 and exists is None, f"status={r.status_code}")

    payload = register_payload("client", "qa.cust.noemail@example.com",
                               CLIENT["password"], **PROFILE)
    del payload["email"]
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
    check("REG8", "missing required field (email) → 422", r.status_code == 422,
          f"status={r.status_code}")

    r = register("client", "qa.cust.nohealth@example.com", CLIENT["password"])
    check("REG9", "client without health profile → 400", r.status_code == 400,
          f"status={r.status_code}")

    r = register("restaurant", "qa.cust.noname@example.com", CLIENT["password"])
    check("REG10", "restaurant without restaurant_name → 400", r.status_code == 400,
          f"status={r.status_code}")

    r = register("admin", "qa.cust.badadmin@qooti-admin.com", CLIENT["password"], age=30)
    check("REG11", "admin sending client health fields → 400", r.status_code == 400,
          f"status={r.status_code}")

    r = register("chef", "qa.cust.badtype@example.com", CLIENT["password"], **PROFILE)
    check("REG12", "unknown user_type → 422 (enum enforced)", r.status_code == 422,
          f"status={r.status_code}")


def test_login():
    print("\n=== Customer login ===")

    r = login_raw(CLIENT)
    body = r.json() if r.status_code == 200 else {}
    check("LOG1", "valid credentials → 200 + bearer token",
          r.status_code == 200 and body.get("access_token")
          and body.get("token_type") == "bearer",
          f"status={r.status_code}")

    user = body.get("user", {})
    check("LOG2", "login response identifies the user as a client",
          user.get("email") == CLIENT["email"] and user.get("user_type") == "client",
          f"email={user.get('email')} type={user.get('user_type')}")

    headers = {"Authorization": f"Bearer {body['access_token']}"}
    r = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
    check("LOG3", "token opens a protected route (/users/me)",
          r.status_code == 200, f"status={r.status_code}")

    r = login_raw({"email": CLIENT["email"], "password": "WrongPassw0rd!"})
    check("LOG4", "wrong password → 401", r.status_code == 401, f"status={r.status_code}")

    r = login_raw({"email": "qa.cust.ghost@example.com", "password": CLIENT["password"]})
    check("LOG5", "unknown email → 401", r.status_code == 401, f"status={r.status_code}")

    r = requests.get(f"{BASE_URL}/api/users/me")
    check("LOG6", "protected route without a token → 401", r.status_code == 401,
          f"status={r.status_code}")

    r = requests.get(f"{BASE_URL}/api/users/me",
                     headers={"Authorization": "Bearer not.a.real.token"})
    check("LOG7", "malformed token → 401", r.status_code == 401, f"status={r.status_code}")

    db_exec("UPDATE app_user SET is_active = FALSE WHERE email = %s;", (CLIENT["email"],))
    try:
        r = login_raw(CLIENT)
        check("LOG8", "deactivated account → 403", r.status_code == 403,
              f"status={r.status_code}")
    finally:
        db_exec("UPDATE app_user SET is_active = TRUE WHERE email = %s;", (CLIENT["email"],))

    r = requests.post(f"{BASE_URL}/api/auth/logout")
    check("LOG9", "logout → 200", r.status_code == 200, f"status={r.status_code}")

    return login(CLIENT)


def test_browse(rest_id, meal_ids):
    print("\n=== Browsing restaurants & meals (public) ===")

    r = requests.get(f"{BASE_URL}/api/restaurants")
    listed = r.json() if r.status_code == 200 else []
    ours = [x for x in listed if x["restaurant_id"] == rest_id]
    check("BRW1", "browsing the restaurant list needs no login → 200 + approved restaurant",
          r.status_code == 200 and len(ours) == 1,
          f"status={r.status_code} found={len(ours)}")

    check("BRW2", "list rows carry the fields the cards render",
          ours and all(k in ours[0] for k in ["restaurant_name", "description", "logo_url"]),
          f"keys={sorted(ours[0]) if ours else None}")

    r = requests.get(f"{BASE_URL}/api/restaurants/{rest_id}")
    detail = r.json() if r.status_code == 200 else {}
    check("BRW3", "restaurant detail → 200 and shows as verified",
          r.status_code == 200 and detail.get("is_verified") is True,
          f"status={r.status_code} verified={detail.get('is_verified')}")

    r = requests.get(f"{BASE_URL}/api/restaurants/{rest_id}/meals")
    meals = r.json().get("meals", []) if r.status_code == 200 else []
    ours = [m for m in meals if m["meal_id"] in meal_ids]
    check("BRW4", "meals list → 200 and includes every QA meal",
          r.status_code == 200 and len(ours) == len(meal_ids),
          f"status={r.status_code} found={len(ours)} of {len(meal_ids)}")

    missing = [f for f in NUTRITION_FIELDS if ours and f not in ours[0]]
    check("BRW5", "each meal card carries full nutritional detail",
          ours and not missing, f"missing={missing}")

    # A restaurant awaiting approval must stay invisible to customers.
    db_exec("UPDATE restaurant SET is_verified = FALSE WHERE restaurant_id = %s;", (rest_id,))
    try:
        hidden = [x["restaurant_id"] for x in requests.get(f"{BASE_URL}/api/restaurants").json()]
        detail = requests.get(f"{BASE_URL}/api/restaurants/{rest_id}")
        check("BRW6", "unapproved restaurant is hidden from the customer (list + detail 404)",
              rest_id not in hidden and detail.status_code == 404,
              f"in_list={rest_id in hidden} detail={detail.status_code}")
    finally:
        db_exec("UPDATE restaurant SET is_verified = TRUE WHERE restaurant_id = %s;", (rest_id,))


def test_select_meals(client, meal_ids):
    print("\n=== Building the order — discount, subscription, meal selection ===")

    r = requests.post(f"{BASE_URL}/api/discount-codes/validate", json={"code": "save10"})
    body = r.json() if r.status_code == 200 else {}
    check("CSEL1", "discount code validates case-insensitively → 200 + id and percentage",
          r.status_code == 200 and body.get("code") == "SAVE10"
          and Decimal(str(body.get("discount_percentage"))) == Decimal("10.00"),
          f"status={r.status_code} body={body}")

    r = requests.post(f"{BASE_URL}/api/discount-codes/validate", json={"code": "NOPE404"})
    check("CSEL2", "unknown discount code → 404", r.status_code == 404,
          f"status={r.status_code}")

    r = requests.post(f"{BASE_URL}/api/subscriptions",
                      json={**SUB, "discount_code_id": body["discount_code_id"]},
                      headers=client)
    sub = r.json() if r.status_code == 200 else {}
    sub_id = sub.get("subscription_id")
    expected = BASE_PRICE * Decimal("0.90")
    check("CSEL3", f"subscription with 10% off → 200 and final price {expected}",
          r.status_code == 200 and Decimal(sub.get("final_price", "0")) == expected,
          f"status={r.status_code} final={sub.get('final_price')}")

    row = db_one("SELECT payment_status FROM payment WHERE subscription_id = %s;", (sub_id,))
    check("CSEL4", "subscription opens an unpaid payment row ('pending')",
          row and row["payment_status"] == "pending", f"db={row}")

    selections = [sel(meal_ids[i % len(meal_ids)], day) for i, day in enumerate(WEEK_DAYS)]
    r = requests.post(f"{BASE_URL}/api/meal-selections",
                      json={"subscription_id": sub_id, "selections": selections},
                      headers=client)
    created = r.json().get("created_order_item_ids", []) if r.status_code == 200 else []
    check("CSEL5", f"one meal per day for the {len(WEEK_DAYS)}-day week → 200 + order items",
          r.status_code == 200 and len(created) == len(WEEK_DAYS),
          f"status={r.status_code} items={len(created)}")

    rows = db_all("""
        SELECT day_date, day_of_week, meal_id FROM order_item
        WHERE subscription_id = %s ORDER BY day_date;
    """, (sub_id,))
    days_in_db = [str(x["day_date"]) for x in rows]
    check("CSEL6", "every selected day is stored once, with the right weekday name",
          days_in_db == WEEK_DAYS
          and all(x["day_of_week"] == date.fromisoformat(str(x["day_date"])).strftime("%A")
                  for x in rows),
          f"days={days_in_db}")

    r = requests.post(f"{BASE_URL}/api/meal-selections",
                      json={"subscription_id": sub_id, "selections": [sel(meal_ids[0], WEEK_DAYS[0])]},
                      headers=client)
    check("CSEL7", "re-selecting a day already booked → 400", r.status_code == 400,
          f"status={r.status_code}")

    return sub_id, created


def test_payment(client, sub_id):
    print("\n=== Paying for the subscription (Moyasar sandbox) ===")

    r = requests.post(f"{BASE_URL}/api/payments",
                      json={"subscription_id": sub_id, **VALID_CARD},
                      headers=client)
    body = r.json() if r.status_code == 200 else {}
    check("CPAY1", "initiate payment → 200, 'pending' + transaction_url",
          r.status_code == 200 and body.get("payment_status") == "pending"
          and body.get("transaction_url"),
          f"status={r.status_code}")

    ok = complete_3ds(body["transaction_url"], "AUTHENTICATED")
    time.sleep(1)
    res = callback(body["transaction_id"])
    check("CPAY2", "3D Secure approved + callback → customer lands on success",
          ok and res.on_result_page and res.status == "success",
          f"3ds={ok} status={res.status} msg={res.message[:60]}")

    row = db_one("""
        SELECT p.payment_status, p.transaction_id, s.status AS sub_status
        FROM payment p JOIN subscription s USING (subscription_id)
        WHERE subscription_id = %s;
    """, (sub_id,))
    check("CPAY3", "DB: payment 'success' with the gateway transaction id stored",
          row["payment_status"] == "success" and row["transaction_id"] == body["transaction_id"],
          f"db={row['payment_status']}")

    r = requests.post(f"{BASE_URL}/api/payments",
                      json={"subscription_id": sub_id, **VALID_CARD},
                      headers=client)
    check("CPAY4", "paying an already-paid subscription → 400", r.status_code == 400,
          f"status={r.status_code}")

    # Contract note: subscription.status defaults to 'confirmed' at creation
    # (schema.sql), so it is NOT a signal of payment — payment_status is.
    # Recorded here so the dashboard assertions below can't be misread.
    unpaid = requests.post(f"{BASE_URL}/api/subscriptions", json=SUB, headers=client).json()
    unpaid_row = db_one("""
        SELECT s.status, p.payment_status FROM subscription s
        JOIN payment p USING (subscription_id) WHERE subscription_id = %s;
    """, (unpaid["subscription_id"],))
    check("CPAY5", "documented: an UNPAID subscription is already 'confirmed' "
                   "(status tracks the order, payment_status tracks the money)",
          unpaid_row["status"] == "confirmed" and unpaid_row["payment_status"] == "pending",
          f"sub={unpaid_row['status']} payment={unpaid_row['payment_status']}")


def test_customer_dashboard(client, sub_id, order_item_ids):
    print("\n=== Customer dashboard — history & weekly schedule ===")

    user_id = db_one("SELECT user_id FROM app_user WHERE email = %s;",
                     (CLIENT["email"],))["user_id"]

    r = requests.get(f"{BASE_URL}/api/subscriptions/{user_id}", headers=client)
    payload = r.json() if r.status_code == 200 else {}
    subs = payload.get("subscriptions", payload if isinstance(payload, list) else [])
    ours = [s for s in subs if s["subscription_id"] == sub_id]
    check("DASH1", "subscription history → 200 and includes the paid subscription",
          r.status_code == 200 and len(ours) == 1,
          f"status={r.status_code} found={len(ours)}")

    check("DASH2", "history row shows the discounted price the customer paid",
          ours and Decimal(str(ours[0]["final_price"])) == BASE_PRICE * Decimal("0.90"),
          f"final={ours[0]['final_price'] if ours else None}")

    other = login(OTHER)
    r = requests.get(f"{BASE_URL}/api/subscriptions/{user_id}", headers=other)
    check("DASH3", "another customer cannot read this history → 403", r.status_code == 403,
          f"status={r.status_code}")

    r = requests.get(f"{BASE_URL}/api/subscriptions/{sub_id}/schedule", headers=client)
    payload = r.json() if r.status_code == 200 else {}
    items = payload.get("schedule", payload.get("items", []))
    check("DASH4", f"weekly schedule → 200 with all {len(order_item_ids)} chosen meals",
          r.status_code == 200 and len(items) == len(order_item_ids),
          f"status={r.status_code} items={len(items)}")

    r = requests.get(f"{BASE_URL}/api/subscriptions/{sub_id}/schedule", headers=other)
    check("DASH5", "another customer cannot read this schedule → 403", r.status_code == 403,
          f"status={r.status_code}")

    r = requests.get(f"{BASE_URL}/api/users/me", headers=client)
    me = r.json() if r.status_code == 200 else {}
    me = me.get("user", me)
    check("DASH6", "profile still matches what was registered at the start",
          r.status_code == 200 and me.get("email") == CLIENT["email"]
          and me.get("address") == PROFILE["address"],
          f"status={r.status_code} email={me.get('email')}")


def main():
    rest_id, meal_ids = setup()

    test_registration()
    client = test_login()
    test_browse(rest_id, meal_ids)
    sub_id, order_item_ids = test_select_meals(client, meal_ids)
    test_payment(client, sub_id)
    test_customer_dashboard(client, sub_id, order_item_ids)

    passed = sum(1 for _, _, ok, _ in results if ok)
    failed = len(results) - passed
    print("\n" + "=" * 50)
    print(f"Total: {len(results)}  Passed: {passed}  Failed: {failed}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
