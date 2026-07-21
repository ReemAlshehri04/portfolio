import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authRequest } from "../../services/auth";
import { useAuth } from "../../context/AuthContext";
import "./AdminOrders.css";
const STATUS_COLORS = {
  confirmed: { bg: "#e6f4ea", color: "#188038" },
  pending: { bg: "#fff4e5", color: "#b06000" },
  cancelled: { bg: "#fdecea", color: "#b3261e" },
};

function AdminOrders() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingRestaurants, setPendingRestaurants] = useState(0);

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  useEffect(() => {
    if (user?.user_type !== "admin") return;

    authRequest("/api/admin/orders")
      .then((data) => setOrders(data.orders || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    authRequest("/api/admin/overview")
      .then((data) => setPendingRestaurants(data.pending_restaurants))
      .catch(() => {});
  }, [user]);

  if (!user) {
    return <div style={{ padding: 48 }}>Please log in.</div>;
  }

  if (user.user_type !== "admin") {
    return <div style={{ padding: 48 }}>Access denied. Admins only.</div>;
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      <div className="admin-body">
        <aside className="admin-sidebar">
          <div className="admin-logo">Qooti Admin</div>
          <nav className="admin-nav">
            <a href="/admin/dashboard" className="admin-nav-item">
              <span className="material-symbols-outlined">dashboard</span>
              Overview
            </a>
            <a href="/admin/pending-restaurants" className="admin-nav-item">
              <span className="material-symbols-outlined">storefront</span>
              Restaurants
              {pendingRestaurants > 0 && (
                <span className="pending-badge">{pendingRestaurants}</span>
              )}
            </a>
            <a href="/admin/customers" className="admin-nav-item">
              <span className="material-symbols-outlined">group</span>
              Customers
            </a>
            <a href="/admin/orders" className="admin-nav-item active">
              <span className="material-symbols-outlined">receipt_long</span>
              Orders
            </a>
          </nav>
          <div className="admin-sidebar-footer">
            <button className="admin-logout-btn" onClick={handleLogout}>Log Out</button>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-header">
            <h1>Orders</h1>
            <p>All customer subscriptions across Qooti.</p>
          </div>

          <div className="section-card">
            {loading ? (
              <div className="table-empty">Loading...</div>
            ) : error ? (
              <div className="table-error">{error}</div>
            ) : orders.length === 0 ? (
              <div className="table-empty">No orders yet.</div>
            ) : (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Delivery Time</th>
                    <th>Final Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.subscription_id}>
                      <td>#{o.subscription_id}</td>
                      <td>{o.full_name}</td>
                      <td>{o.email}</td>
                      <td>{o.start_date}</td>
                      <td>{o.end_date}</td>
                      <td>{o.delivery_time}</td>
                      <td>SAR {o.final_price}</td>
                      <td>
                        <span
                          className="status-pill"
                          style={{
                            background: STATUS_COLORS[o.status]?.bg || "#f4f4ee",
                            color: STATUS_COLORS[o.status]?.color || "#414941",
                          }}
                        >
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default AdminOrders;
