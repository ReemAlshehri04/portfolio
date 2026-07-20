import "./WeeklyMealSelection.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import { apiGet, authRequest, getCurrentUser } from "../../services/auth";

const PLAN_PRICE = 250.0;

const toIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

function buildWeek() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + daysUntilSunday);

  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
  return names.map((full, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return {
      key: full.toLowerCase().slice(0, 3),
      label: full.slice(0, 3).toUpperCase(),
      full,
      date: d.getDate(),
      iso: toIso(d),
    };
  });
}
function WeeklyMealSelection() {
  const navigate = useNavigate();
  const days = useMemo(buildWeek, []);
  const [activeDay, setActiveDay] = useState(days[0].key);
  const [meals, setMeals] = useState([]);
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [activeSubscription, setActiveSubscription] = useState(null);
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      setCheckingSubscription(false);
      return;
    }

    authRequest(`/api/subscriptions/${user.user_id}`)
      .then((data) => {
        const today = toIso(new Date());
        const active = (data.subscriptions || []).find(
          (s) => s.status === "confirmed" && s.end_date >= today
        );
        setActiveSubscription(active || null);
      })
      .catch(() => {})
      .finally(() => setCheckingSubscription(false));
  }, []);

  useEffect(() => {
    apiGet("/api/restaurants")
      .then(async (restaurants) => {
        const perRestaurant = await Promise.all(
          restaurants.map((r) =>
            apiGet(`/api/restaurants/${r.restaurant_id}/meals`)
              .then((data) =>
                (data.meals ?? []).map((m) => ({
                  ...m,
                  restaurant_name: r.restaurant_name,
                }))
              )
              .catch(() => [])
          )
        );
        setMeals(perRestaurant.flat());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const mealsByRestaurant = useMemo(() => {
    const groups = new Map();
    meals.forEach((meal) => {
      const key = meal.restaurant_name || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(meal);
    });
    return Array.from(groups.entries());
  }, [meals]);

  const handleSelect = (meal) => {
    setSelections((prev) => ({ ...prev, [activeDay]: meal }));

    const idx = days.findIndex((d) => d.key === activeDay);
    const next = days
      .slice(idx + 1)
      .concat(days.slice(0, idx))
      .find((d) => !selections[d.key] && d.key !== activeDay);
    if (next) setActiveDay(next.key);
  };

  const handleRemove = (dayKey) => {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[dayKey];
      return next;
    });
  };

  const selectedCount = Object.keys(selections).length;
  const totalCalories = Object.values(selections).reduce(
    (sum, m) => sum + (m.calories || 0),
    0
  );
  const allSelected = selectedCount === days.length;
  const activeMeal = selections[activeDay];
  const activeDayInfo = days.find((d) => d.key === activeDay);

  const handleReviewOrder = () => {
    if (!allSelected) return;
    navigate("/order-summary", {
      state: {
        startDate: days[0].iso,
        endDate: days[days.length - 1].iso,
        days: days.map((d) => ({
          full: d.full,
          iso: d.iso,
          meal_id: selections[d.key].meal_id,
          name: selections[d.key].name,
          calories: selections[d.key].calories,
          restaurant_name: selections[d.key].restaurant_name,
        })),
      },
    });
  };

  if (checkingSubscription) {
    return (
      <div className="wms-body">
        <Navbar />
        <main style={{ padding: "64px 32px", textAlign: "center" }}>
          Checking your subscription…
        </main>
      </div>
    );
  }

  if (activeSubscription) {
    return (
      <div className="wms-body">
        <Navbar />
        <main
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: "64px 32px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>
            You already have an active plan
          </h1>
          <p style={{ color: "#5e5e5b", marginBottom: 24 }}>
            Your current weekly plan runs until {activeSubscription.end_date}.
            You can start a new selection once it ends.
          </p>
          <Link to="/profile" style={{ color: "#325f3f", fontWeight: 600 }}>
            Go to your profile →
          </Link>
        </main>
      </div>
    );
  }

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <div className="wms-body">
        <Navbar />

        <main className="wms-main">
          <div>
            <h1 className="wms-title">Weekly Selection</h1>
            <p className="wms-subtitle">
              Pick one meal per day from any of our partner restaurants for next week (Sunday to Thursday).
            </p>

            {error && <div className="wms-error">{error}</div>}

            <div className="wms-tabs">
              {days.map((day) => (
                <div
                  key={day.key}
                  className={`wms-tab ${activeDay === day.key ? "active" : ""} ${
                    selections[day.key] ? "filled" : ""
                  }`}
                  onClick={() => setActiveDay(day.key)}
                >
                  <div className="wms-tab-label">{day.label}</div>
                  <div className="wms-tab-date">{day.date}</div>
                </div>
              ))}
            </div>

            <p className="wms-section-title">{activeDayInfo.full} Selection</p>

            {activeMeal ? (
              <div className="wms-meal-card">
                <div className="wms-meal-img">
                  {activeMeal.image_url ? <img src={activeMeal.image_url} alt={activeMeal.name} /> : "🍽️"}
                </div>
                <div className="wms-meal-info">
                  <div className="wms-tags">
                    {(activeMeal.tags || []).map((tag) => (
                      <span key={tag} className="wms-tag">{tag}</span>
                    ))}
                  </div>
                  <div className="wms-meal-name">{activeMeal.name}</div>
                  <div className="wms-meal-restaurant">
                    {activeMeal.restaurant_name}
                  </div>
                  <div className="wms-meal-stats">
                    <span>{activeMeal.calories} kcal</span>
                    <span>{activeMeal.protein_g}g protein</span>
                    <span>{activeMeal.carbs_g}g carbs</span>
                    <span>{activeMeal.fats_g}g fat</span>
                  </div>
                  <div className="wms-meal-footer">
                    <span />
                    <button
                      className="wms-change-btn"
                      onClick={() => handleRemove(activeDay)}
                    >
                      Change
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="wms-empty">
                No meal selected for {activeDayInfo.full} yet — choose one below.
              </div>
            )}

            <p className="wms-section-title">Available Meals</p>
            {loading ? (
              <div className="wms-empty">Loading meals…</div>
            ) : meals.length === 0 ? (
              <div className="wms-empty">
                No meals are available right now.
              </div>
            ) : (
              mealsByRestaurant.map(([restaurantName, restaurantMeals]) => (
                <div key={restaurantName} className="wms-restaurant-group">
                  <h3 className="wms-restaurant-heading">{restaurantName}</h3>
                  <div className="wms-pick-grid">
                    {restaurantMeals.map((meal) => {
                      const chosen = activeMeal?.meal_id === meal.meal_id;
                      return (
                        <div
                          key={meal.meal_id}
                          className={`wms-pick-card ${chosen ? "chosen" : ""}`}
                        >
                          <div className="wms-pick-img">
                            {meal.image_url ? <img src={meal.image_url} alt={meal.name} /> : null}
                          </div>
                          <div className="wms-pick-name">{meal.name}</div>
                          <div className="wms-pick-stats">
                            <span>{meal.calories} kcal</span>
                            <span>{meal.protein_g}g protein</span>
                          </div>
                          <div className="wms-tags">
                            {(meal.tags || []).map((tag) => (
                              <span key={tag} className="wms-tag">{tag}</span>
                            ))}
                          </div>
                          <button
                            className={`wms-pick-btn ${chosen ? "chosen" : ""}`}
                            onClick={() => handleSelect(meal)}
                          >
                            {chosen
                              ? "Selected ✓"
                              : `Choose for ${activeDayInfo.label}`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <aside className="wms-summary">
            <div className="wms-summary-title">Weekly Summary</div>

            <div className="wms-summary-row">
              <span>Meals Selected</span>
              <strong>{selectedCount}/{days.length}</strong>
            </div>
            <div className="wms-summary-row">
              <span>Total Calories</span>
              <strong>{totalCalories.toLocaleString()}kcal</strong>
            </div>
            <div className="wms-summary-row">
              <span>Week Starts</span>
              <strong>{days[0].full} {days[0].iso}</strong>
            </div>

            <div className="wms-total-row">
              <span>Weekly Plan</span>
              <span>SAR {PLAN_PRICE.toFixed(2)}</span>
            </div>

            <button
              className="wms-review-btn"
              disabled={!allSelected}
              onClick={handleReviewOrder}
            >
              {allSelected
                ? "Review My Order"
                : `Select ${days.length - selectedCount} more meal${
                    days.length - selectedCount > 1 ? "s" : ""
                  }`}
            </button>

            <p className="wms-plan-note">
              One flat weekly price — Sunday to Thursday lunch, delivery included.
            </p>
          </aside>
        </main>
      </div>
    </>
  );
}

export default WeeklyMealSelection;