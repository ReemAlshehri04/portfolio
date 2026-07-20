"""
Restaurant-flow test suite — Qooti Healthy Meals Platform.

Run with the backend venv (has requests + psycopg2) while the server is up:

    cd BACKEND/project/backend
    .venv/bin/python -m uvicorn main:app                        # terminal 1
    .venv/bin/python ../../../testing/test-restaurant-flow.py   # terminal 2

Covers the full restaurant lifecycle end-to-end:
  Onboarding   — restaurant registers → pending → admin approves/rejects →
                 public visibility flips accordingly
  Meal CRUD    — POST/PUT/DELETE /api/meals + GET /api/restaurants/:id/meals,
                 with ownership, role, and validation checks
  Selections   — client saves weekly meal selections against a subscription
                 (subscriptions are 'confirmed' on creation per schema default,
                 so no payment/Moyasar step is needed here)
  Orders       — GET /api/restaurants/:id/orders?day=… shows the restaurant
                 only its own confirmed orders for that weekday

Idempotent across runs: QA restaurants are reset to pending at start, and a
fresh subscription is created each run so selection tests start clean.
Requires only the local server + PostgreSQL (no internet access).
"""

import re
import sys
from datetime import date
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

REST_A = {"email": "qa.flow.rest.a@example.com", "password": "Passw0rd!"}
REST_B = {"email": "qa.flow.rest.b@example.com", "password": "Passw0rd!"}
# Admin emails must be on @qooti_admin.com (DB chk_admin_email_domain)
ADMIN = {"email": "qa.flow.admin@qooti_admin.com", "password": "Passw0rd!"}
CLIENT_A = {"email": "qa.flow.client.a@example.com", "password": "Passw0rd!"}
CLIENT_B = {"email": "qa.flow.client.b@example.com", "password": "Passw0rd!"}

# Subscription window 2026-07-15 (Wed) → 2026-07-21 (Tue). The day_of_week
# enum only has Sunday–Thursday (Saudi work week), so valid selectable days
# inside the window are Wed 15, Thu 16, Sun 19, Mon 20, Tue 21.
SUB = {"start_date": "2026-07-15", "end_date": "2026-07-21", "delivery_time": "09:00"}

MEAL = {
    "name": "QA Grilled Chicken Bowl",
    "description": "Grilled chicken with brown rice and broccoli",
    "ingredients": "chicken breast, brown rice, broccoli, olive oil",
    "calories": 520,
    "protein_g": 42.0,
    "carbs_g": 55.0,
    "fats_g": 12.0,
    "image_url": "https://example.com/qa-meal.jpg",
    "tags": ["high-protein", "gluten-free"],
}

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


def create_meal(headers, restaurant_id, **overrides):
    return requests.post(f"{BASE_URL}/api/meals",
                         json={**MEAL, "restaurant_id": restaurant_id, **overrides},
                         headers=headers)


def meal_id_from(response):
    m = re.search(r"Meal ID: (\d+)", response.json().get("message", ""))
    return int(m.group(1)) if m else None


def public_meal_ids(restaurant_id):
    r = requests.get(f"{BASE_URL}/api/restaurants/{restaurant_id}/meals")
    return [m["meal_id"] for m in r.json().get("meals", [])]


def public_restaurant_ids():
    return [r["restaurant_id"] for r in requests.get(f"{BASE_URL}/api/restaurants").json()]


def select_meals(headers, subscription_id, selections):
    return requests.post(f"{BASE_URL}/api/meal-selections",
                         json={"subscription_id": subscription_id, "selections": selections},
                         headers=headers)


def sel(meal_id, day_date):
    d = date.fromisoformat(day_date)
    return {"meal_id": meal_id, "day_date": day_date, "day_of_week": d.strftime("%A")}


def setup():
    client_fields = dict(age=30, gender="female", height_cm=165.0, weight_kg=60.0,
                         health_goal="maintain", address="Riyadh, KSA")
    register("client", CLIENT_A["email"], CLIENT_A["password"], **client_fields)
    register("client", CLIENT_B["email"], CLIENT_B["password"], **client_fields)
    register("restaurant", REST_A["email"], REST_A["password"],
             restaurant_name="QA Flow Kitchen A", description="QA restaurant A")
    register("restaurant", REST_B["email"], REST_B["password"],
             restaurant_name="QA Flow Kitchen B", description="QA restaurant B")
    register("admin", ADMIN["email"], ADMIN["password"])

    # Reset the QA restaurants to pending so the approval flow is
    # deterministic on every run.
    db_exec("""
        UPDATE restaurant SET is_verified = FALSE, rejection_reason = NULL
        WHERE user_id IN (SELECT user_id FROM app_user WHERE email IN (%s, %s));
    """, (REST_A["email"], REST_B["email"]))


def restaurant_id_for(headers):
    r = requests.get(f"{BASE_URL}/api/restaurants/me", headers=headers)
    r.raise_for_status()
    return r.json()["restaurant"]["restaurant_id"]


def test_onboarding_and_approval(rest_a, rest_b, admin, client_a):
    print("\n=== Restaurant onboarding & admin approval ===")

    r = requests.get(f"{BASE_URL}/api/restaurants/me", headers=rest_a)
    body = r.json().get("restaurant", {})
    rest_a_id = body.get("restaurant_id")
    check("RF1", "registered restaurant → /restaurants/me shows pending profile",
          r.status_code == 200 and body.get("is_verified") is False
          and body.get("rejection_reason") is None,
          f"status={r.status_code} verified={body.get('is_verified')}")

    listed = public_restaurant_ids()
    detail = requests.get(f"{BASE_URL}/api/restaurants/{rest_a_id}")
    check("RF2", "pending restaurant hidden from public list and detail",
          rest_a_id not in listed and detail.status_code == 404,
          f"in_list={rest_a_id in listed} detail={detail.status_code}")

    r = requests.get(f"{BASE_URL}/api/restaurants/me", headers=client_a)
    check("RF3", "client requests /restaurants/me → 403", r.status_code == 403,
          f"status={r.status_code}")

    r = requests.get(f"{BASE_URL}/api/admin/restaurants", params={"status": "pending"},
                     headers=admin)
    pending_ids = [x["restaurant_id"] for x in r.json()]
    check("RF4", "admin pending list includes the new restaurant",
          r.status_code == 200 and rest_a_id in pending_ids,
          f"status={r.status_code} pending={pending_ids}")

    r = requests.patch(f"{BASE_URL}/api/admin/restaurants/{rest_a_id}/status",
                       json={"status": "approved"}, headers=client_a)
    check("RF5", "non-admin approves restaurant → 403", r.status_code == 403,
          f"status={r.status_code}")

    r = requests.patch(f"{BASE_URL}/api/admin/restaurants/{rest_a_id}/status",
                       json={"status": "approved"}, headers=admin)
    check("RF6", "admin approves restaurant → 200, is_verified true",
          r.status_code == 200 and r.json().get("is_verified") is True,
          f"status={r.status_code}")

    listed = public_restaurant_ids()
    detail = requests.get(f"{BASE_URL}/api/restaurants/{rest_a_id}")
    check("RF7", "approved restaurant visible in public list and detail",
          rest_a_id in listed and detail.status_code == 200,
          f"in_list={rest_a_id in listed} detail={detail.status_code}")

    rest_b_id = restaurant_id_for(rest_b)
    r = requests.patch(f"{BASE_URL}/api/admin/restaurants/{rest_b_id}/status",
                       json={"status": "rejected", "rejection_reason": "QA: docs missing"},
                       headers=admin)
    row = db_one("SELECT is_verified, rejection_reason FROM restaurant WHERE restaurant_id = %s;",
                 (rest_b_id,))
    check("RF8", "admin rejects restaurant → reason stored, stays hidden publicly",
          r.status_code == 200 and row["is_verified"] is False
          and row["rejection_reason"] == "QA: docs missing"
          and rest_b_id not in public_restaurant_ids(),
          f"status={r.status_code} db={row}")

    return rest_a_id, rest_b_id


def test_meal_crud(rest_a, rest_b, client_a, rest_a_id, rest_b_id):
    print("\n=== Meal CRUD (restaurant) ===")

    r = create_meal(rest_a, rest_a_id)
    meal_id = meal_id_from(r)
    check("MEAL1", "restaurant creates meal → 200 + meal id",
          r.status_code == 200 and meal_id is not None,
          f"status={r.status_code} meal_id={meal_id}")

    check("MEAL2", "created meal appears in public restaurant meals list",
          meal_id in public_meal_ids(rest_a_id), f"meal_id={meal_id}")

    r = create_meal(rest_b, rest_a_id)
    check("MEAL3", "create meal for someone else's restaurant → 403",
          r.status_code == 403, f"status={r.status_code}")

    r = create_meal(client_a, rest_a_id)
    check("MEAL4", "client creates meal → 403", r.status_code == 403,
          f"status={r.status_code}")

    r = create_meal({}, rest_a_id)
    check("MEAL5", "no auth token → 401", r.status_code == 401, f"status={r.status_code}")

    r = create_meal(rest_a, rest_a_id, name="   ")
    check("MEAL6", "empty meal name → 400", r.status_code == 400, f"status={r.status_code}")

    r = create_meal(rest_a, rest_a_id, calories=-10)
    check("MEAL7", "negative calories → 400", r.status_code == 400, f"status={r.status_code}")

    r = create_meal(rest_a, rest_a_id, tags=[])
    check("MEAL8", "empty tags list → 400", r.status_code == 400, f"status={r.status_code}")

    r = requests.put(f"{BASE_URL}/api/meals/{meal_id}",
                     json={"name": "QA Updated Bowl", "calories": 480}, headers=rest_a)
    row = db_one("SELECT name, calories, protein_g FROM meal WHERE meal_id = %s;", (meal_id,))
    check("MEAL9", "restaurant updates own meal → 200, fields changed",
          r.status_code == 200 and row["name"] == "QA Updated Bowl" and row["calories"] == 480,
          f"status={r.status_code} db={row['name']}/{row['calories']}")

    check("MEAL10", "partial update preserves untouched fields (COALESCE)",
          float(row["protein_g"]) == MEAL["protein_g"], f"protein={row['protein_g']}")

    r = requests.put(f"{BASE_URL}/api/meals/{meal_id}", json={"name": "hijack"}, headers=rest_b)
    check("MEAL11", "update someone else's meal → 403", r.status_code == 403,
          f"status={r.status_code}")

    r = requests.put(f"{BASE_URL}/api/meals/{meal_id}", json={"name": "  "}, headers=rest_a)
    check("MEAL12", "update with empty name → 400", r.status_code == 400,
          f"status={r.status_code}")

    # Create a second meal to soft-delete (the first stays for selections)
    doomed_id = meal_id_from(create_meal(rest_a, rest_a_id, name="QA Doomed Meal"))
    r = requests.delete(f"{BASE_URL}/api/meals/{doomed_id}", headers=rest_b)
    check("MEAL13", "delete someone else's meal → 403", r.status_code == 403,
          f"status={r.status_code}")

    r = requests.delete(f"{BASE_URL}/api/meals/{doomed_id}", headers=rest_a)
    row = db_one("SELECT is_available FROM meal WHERE meal_id = %s;", (doomed_id,))
    check("MEAL14", "delete own meal → 200, soft-deleted and gone from public list",
          r.status_code == 200 and row["is_available"] is False
          and doomed_id not in public_meal_ids(rest_a_id),
          f"status={r.status_code} available={row['is_available']}")

    r = requests.get(f"{BASE_URL}/api/restaurants/999999/meals")
    check("MEAL15", "meals of non-existent restaurant → 404", r.status_code == 404,
          f"status={r.status_code}")

    # Restaurant B was rejected in RF8, so like the public detail endpoint its
    # meals must be hidden (404) even though the row exists.
    r = requests.get(f"{BASE_URL}/api/restaurants/{rest_b_id}/meals")
    check("MEAL16", "meals of unapproved (rejected) restaurant → 404",
          r.status_code == 404, f"status={r.status_code}")

    return meal_id, doomed_id


def test_meal_selections(client_a, client_b, rest_a, meal_id, doomed_id):
    print("\n=== Meal selections (client) ===")

    r = requests.post(f"{BASE_URL}/api/subscriptions", json=SUB, headers=client_a)
    sub_id = r.json()["subscription_id"]

    r = select_meals(client_a, sub_id,
                     [sel(meal_id, "2026-07-15"), sel(meal_id, "2026-07-16")])
    ids = r.json().get("created_order_item_ids", [])
    check("SEL1", "valid 2-day selection → 200 + 2 order items",
          r.status_code == 200 and len(ids) == 2, f"status={r.status_code} ids={ids}")

    r = select_meals(client_a, sub_id,
                     [sel(meal_id, "2026-07-19"), sel(meal_id, "2026-07-19")])
    check("SEL2", "duplicate day inside one request → 400", r.status_code == 400,
          f"status={r.status_code}")

    r = select_meals(client_a, sub_id, [sel(meal_id, "2026-07-15")])
    check("SEL3", "day already selected earlier → 400", r.status_code == 400,
          f"status={r.status_code}")

    r = select_meals(client_a, sub_id, [sel(meal_id, "2026-07-22")])
    check("SEL4", "date outside subscription range → 400", r.status_code == 400,
          f"status={r.status_code}")

    r = select_meals(client_a, sub_id, [sel(doomed_id, "2026-07-20")])
    check("SEL5", "soft-deleted meal → 404 not found/unavailable", r.status_code == 404,
          f"status={r.status_code}")

    r = select_meals(client_b, sub_id, [sel(meal_id, "2026-07-20")])
    check("SEL6", "another client's subscription → 403", r.status_code == 403,
          f"status={r.status_code}")

    r = select_meals(rest_a, sub_id, [sel(meal_id, "2026-07-20")])
    check("SEL7", "restaurant user selects meals → 403", r.status_code == 403,
          f"status={r.status_code}")

    r = select_meals(client_a, 999999, [sel(meal_id, "2026-07-20")])
    check("SEL8", "non-existent subscription → 404", r.status_code == 404,
          f"status={r.status_code}")

    cancelled = requests.post(f"{BASE_URL}/api/subscriptions", json=SUB,
                              headers=client_a).json()["subscription_id"]
    db_exec("UPDATE subscription SET status = 'cancelled' WHERE subscription_id = %s;",
            (cancelled,))
    r = select_meals(client_a, cancelled, [sel(meal_id, "2026-07-20")])
    check("SEL9", "cancelled subscription → 400", r.status_code == 400,
          f"status={r.status_code}")

    return sub_id, ids


def test_restaurant_orders(rest_a, rest_b, client_a, rest_a_id, rest_b_id, order_item_ids):
    print("\n=== Restaurant orders view ===")

    r = requests.get(f"{BASE_URL}/api/restaurants/{rest_a_id}/orders",
                     params={"day": "Wednesday"}, headers=rest_a)
    orders = r.json().get("orders", [])
    ours = [o for o in orders if o["order_item_id"] in order_item_ids]
    check("ORD1", "restaurant sees its Wednesday orders with meal + client details",
          r.status_code == 200 and len(ours) == 1
          and ours[0]["meal_name"] and ours[0]["client_name"] and ours[0]["delivery_address"],
          f"status={r.status_code} matched={len(ours)} of {len(orders)} total")

    r = requests.get(f"{BASE_URL}/api/restaurants/{rest_b_id}/orders",
                     params={"day": "Wednesday"}, headers=rest_b)
    leaked = [o for o in r.json().get("orders", []) if o["order_item_id"] in order_item_ids]
    check("ORD2", "another restaurant's orders view never shows these items",
          r.status_code == 200 and leaked == [], f"status={r.status_code} leaked={leaked}")

    r = requests.get(f"{BASE_URL}/api/restaurants/{rest_a_id}/orders",
                     params={"day": "Wednesday"}, headers=client_a)
    check("ORD3", "client requests restaurant orders → 403", r.status_code == 403,
          f"status={r.status_code}")

    r = requests.get(f"{BASE_URL}/api/restaurants/{rest_b_id}/orders",
                     params={"day": "Wednesday"}, headers=rest_a)
    check("ORD4", "restaurant requests another restaurant's orders → 403",
          r.status_code == 403, f"status={r.status_code}")

    r = requests.get(f"{BASE_URL}/api/restaurants/{rest_a_id}/orders",
                     params={"day": "Wednesday"})
    check("ORD5", "no auth token → 401", r.status_code == 401, f"status={r.status_code}")

    r = requests.get(f"{BASE_URL}/api/restaurants/{rest_a_id}/orders", headers=rest_a)
    check("ORD6", "missing day query param → 422", r.status_code == 422,
          f"status={r.status_code}")


def main():
    setup()
    rest_a = login(REST_A)
    rest_b = login(REST_B)
    admin = login(ADMIN)
    client_a = login(CLIENT_A)
    client_b = login(CLIENT_B)

    rest_a_id, rest_b_id = test_onboarding_and_approval(rest_a, rest_b, admin, client_a)
    meal_id, doomed_id = test_meal_crud(rest_a, rest_b, client_a, rest_a_id, rest_b_id)
    sub_id, order_item_ids = test_meal_selections(client_a, client_b, rest_a, meal_id, doomed_id)
    test_restaurant_orders(rest_a, rest_b, client_a, rest_a_id, rest_b_id, order_item_ids)

    passed = sum(1 for _, _, ok, _ in results if ok)
    failed = len(results) - passed
    print("\n" + "=" * 50)
    print(f"Total: {len(results)}  Passed: {passed}  Failed: {failed}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
