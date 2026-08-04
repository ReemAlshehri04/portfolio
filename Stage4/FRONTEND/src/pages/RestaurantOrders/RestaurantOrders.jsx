import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authRequest } from "../../services/auth";
import { useAuth } from "../../context/AuthContext";
import qootiLogo from "../../assets/qooti-logo.svg";
import "./RestaurantOrders.css";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

function RestaurantOrders() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeDay, setActiveDay] = useState("Sunday");
  const [ordersByDay, setOrdersByDay] = useState({});
  const [restaurantId, setRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    authRequest("/api/restaurants/me")
      .then((data) => setRestaurantId(data.restaurant.restaurant_id))
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!restaurantId) return;

    setLoading(true);
    setError("");
    Promise.all(
      DAYS.map((day) =>
        authRequest(`/api/restaurants/${restaurantId}/orders?day=${day}`)
          .then((data) => [day, data.orders || []])
          .catch(() => [day, []])
      )
    )
      .then((results) => {
        const map = {};
        results.forEach(([day, orders]) => { map[day] = orders; });
        setOrdersByDay(map);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const activeOrders = ordersByDay[activeDay] || [];
  const filteredOrders = activeOrders.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return o.client_name.toLowerCase().includes(q) || o.meal_name.toLowerCase().includes(q);
  });

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      <div className="ro-body">
        <aside className="ro-sidebar">
          <div className="ro-logo">
            <img src={qootiLogo} alt="Qooti" style={{ width: 88, height: 88 }} />
            <small>Partner Portal</small>
          </div>
          <nav className="ro-nav">
            <Link to="/restaurant/meals" className="ro-nav-item">
              <span className="material-symbols-outlined">restaurant_menu</span>
              My Meals
            </Link>
            <Link to="/restaurant/orders" className="ro-nav-item active">
              <span className="material-symbols-outlined">receipt_long</span>
              Orders
            </Link>
          </nav>
          <Link to="/restaurant/meals/new" className="ro-add-btn">+ Add New Meal</Link>
          <div className="ro-sidebar-footer">
            <button className="ro-logout-btn" onClick={handleLogout}>Log Out</button>
          </div>
        </aside>

        <main className="ro-main">
          <div className="ro-header">
            <div>
              <h1 className="ro-title">Daily Order Fulfillment</h1>
              <p className="ro-subtitle">Manage and track your incoming kitchen requests.</p>
            </div>
            {user && <span className="ro-user">{user.full_name}</span>}
          </div>

          <div className="ro-day-tabs">
            {DAYS.map((day) => (
              <button
                key={day}
                className={`ro-day-tab ${activeDay === day ? "active" : ""}`}
                onClick={() => setActiveDay(day)}
              >
                {day}
                <span className="ro-day-count">{(ordersByDay[day] || []).length}</span>
              </button>
            ))}
          </div>

          {error && <p className="ro-error">{error}</p>}

          <div className="ro-section-header">
            <span className="ro-section-title">{activeDay}'s Queue</span>
            <input
              className="ro-search"
              type="text"
              placeholder="Search customer or meal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : filteredOrders.length === 0 ? (
            <div className="ro-empty">
              {activeOrders.length === 0
                ? `No confirmed orders for ${activeDay} yet.`
                : "No orders match your search."}
            </div>
          ) : (
            <table className="ro-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Meal</th>
                  <th>Delivery Address</th>
                  <th>Delivery Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.order_item_id}>
                    <td>{o.client_name}</td>
                    <td>{o.meal_name}</td>
                    <td>{o.delivery_address}</td>
                    <td>{o.delivery_time}</td>
                    <td>
                      <span className="ro-status-pill">{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      </div>
    </>
  );
}

export default RestaurantOrders;
