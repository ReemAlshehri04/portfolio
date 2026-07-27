# Qooti — Healthy Meals Platform

Qooti connects customers with health-focused restaurant partners for weekly
meal subscriptions: browse restaurants, pick a meal for each day of the week,
pay, and get it delivered. Restaurants manage their own menus and orders, and
admins approve restaurants and oversee the platform.

**This is a final project for Holberton School**

## Tech stack

- **Frontend:** React 19 + Vite, React Router
- **Backend:** FastAPI (Python), PostgreSQL
- **Payments:** Moyasar (sandbox)

## Features

### Customer
- Register / log in
- Browse restaurant partners and their meals
- Build a weekly meal selection (Sunday–Thursday) from any partner restaurant
- Apply discount codes and pay via Moyasar, with a payment result page
- Customer dashboard with order/subscription summary
- Profile management

### Restaurant
- Restaurant registration and login (subject to admin approval)
- Manage own meals: add, edit, delete
- View incoming orders, grouped by day

### Admin
- Admin login
- Dashboard overview
- Approve or reject pending restaurant registrations
- View and manage customers
- View all orders

## Project structure

```
Stage1/    # Project proposal
Stage 2/   # Project charter
Stage3/    # Technical documentation and diagrams
Stage4/    # Implementation
├── FRONTEND/   # React + Vite app
├── BACKEND/    # FastAPI app
└── testing/    # End-to-end test suites and QA docs (see Stage4/testing/README.md)
```

## Getting started

### Backend

```bash
cd BACKEND
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn main:app --reload
```

Create a `.env` in `BACKEND/` with:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Secret used to sign auth tokens |
| `MOYASAR_SECRET_KEY` | Moyasar sandbox API key |
| `FRONTEND_URL` | Deployed frontend origin, added to CORS allow-list |

Load the schema and seed data with `schema.sql` and `seed_data.sql`.

### Frontend

```bash
cd FRONTEND
npm install
npm run dev
```

Create a `.env` in `FRONTEND/` with:

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API |

## Testing

See [`Stage4/testing/README.md`](Stage4/testing/README.md) for the automated
end-to-end suites (customer, restaurant, admin flows) and the production
smoke check.

## Authors

See [`AUTHORS.md`](AUTHORS.md).
