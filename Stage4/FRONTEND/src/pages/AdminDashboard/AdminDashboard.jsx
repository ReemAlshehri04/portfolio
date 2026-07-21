import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authRequest } from "../../services/auth";
import { useAuth } from "../../context/AuthContext";
import "./AdminDashboard.css";

const RESTAURANT_STATUS_COLORS = {
  Approved: { bg: "#e8f5e9", color: "#2e7d32" },
  Pending: { bg: "#fff8e1", color: "#b06000" },
  Rejected: { bg: "#fce4ec", color: "#b3261e" },
};

function restaurantStatus(r) {
  if (r.is_verified) return "Approved";
  if (r.rejection_reason) return "Rejected";
  return "Pending";
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [stats, setStats] = useState({
    totalRestaurants: 0,
    totalCustomers: 0,
    totalOrders: 0,
    pendingRestaurants: 0,
  });
  const [loading, setLoading] = useState(true);

  const [restaurants, setRestaurants] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [restaurantsError, setRestaurantsError] = useState("");

  useEffect(() => {
    if (user?.user_type !== "admin") return;

    authRequest("/api/admin/overview")
      .then((data) =>
        setStats({
          totalRestaurants: data.total_restaurants,
          totalCustomers: data.total_customers,
          totalOrders: data.total_orders,
          pendingRestaurants: data.pending_restaurants,
        })
      )
      .catch(() => {})
      .finally(() => setLoading(false));

    authRequest("/api/admin/restaurants")
      .then((data) => setRestaurants(data || []))
      .catch((err) => setRestaurantsError(err.message))
      .finally(() => setLoadingRestaurants(false));
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

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
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-logo">Qooti Admin</div>
          <nav className="admin-nav">
            <a href="/admin/dashboard" className="admin-nav-item active">
              <span className="material-symbols-outlined">dashboard</span>
              Overview
            </a>
            <a href="/admin/pending-restaurants" className="admin-nav-item">
              <span className="material-symbols-outlined">storefront</span>
              Restaurants
              {stats.pendingRestaurants > 0 && (
                <span className="pending-badge">{stats.pendingRestaurants}</span>
              )}
            </a>
            <a href="/admin/customers" className="admin-nav-item">
              <span className="material-symbols-outlined">group</span>
              Customers
            </a>
            <a href="/admin/orders" className="admin-nav-item">
              <span className="material-symbols-outlined">receipt_long</span>
              Orders
            </a>
          </nav>
          <div className="admin-sidebar-footer">
            <button className="admin-logout-btn" onClick={handleLogout}>Log Out</button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="admin-main">
          <div className="admin-header">
            <h1>Admin Overview</h1>
            <p>Welcome back — here's what's happening on Qooti today.</p>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon green">
                <span className="material-symbols-outlined">storefront</span>
              </div>
              <div className="stat-value">{loading ? "—" : stats.totalRestaurants}</div>
              <div className="stat-label">Total Restaurants</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue">
                <span className="material-symbols-outlined">group</span>
              </div>
              <div className="stat-value">{loading ? "—" : stats.totalCustomers}</div>
              <div className="stat-label">Total Customers</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon amber">
                <span className="material-symbols-outlined">receipt_long</span>
              </div>
              <div className="stat-value">{loading ? "—" : stats.totalOrders}</div>
              <div className="stat-label">Total Orders</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red">
                <span className="material-symbols-outlined">pending_actions</span>
              </div>
              <div className="stat-value">{loading ? "—" : stats.pendingRestaurants}</div>
              <div className="stat-label">Pending Approvals</div>
            </div>
          </div>

          {/* Quick Actions */}
          <p className="section-title">Quick Actions</p>
          <div className="quick-actions">
            <a href="/admin/pending-restaurants" className="action-card">
              <div className="action-icon">
                <span className="material-symbols-outlined">how_to_reg</span>
              </div>
              <div className="action-text">
                <h3>Review Restaurants</h3>
                <p>Approve or reject pending registrations</p>
              </div>
            </a>
            <a href="/admin/customers" className="action-card">
              <div className="action-icon">
                <span className="material-symbols-outlined">manage_accounts</span>
              </div>
              <div className="action-text">
                <h3>Manage Customers</h3>
                <p>View and manage customer accounts</p>
              </div>
            </a>
            <a href="/admin/orders" className="action-card">
              <div className="action-icon">
                <span className="material-symbols-outlined">local_shipping</span>
              </div>
              <div className="action-text">
                <h3>View Orders</h3>
                <p>Monitor all active subscriptions</p>
              </div>
            </a>
          </div>

          {/* Restaurants */}
          <p className="section-title">Restaurants</p>
          <div className="section-card">
            {restaurantsError ? (
              <div className="table-error">{restaurantsError}</div>
            ) : loadingRestaurants ? (
              <div className="table-empty">Loading...</div>
            ) : restaurants.length === 0 ? (
              <div className="table-empty">No restaurants registered yet.</div>
            ) : (
              <table className="restaurants-table">
                <thead>
                  <tr>
                    <th>Restaurant Name</th>
                    <th>Status</th>
                    <th>Registered On</th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.map((r) => {
                    const status = restaurantStatus(r);
                    return (
                      <tr key={r.restaurant_id}>
                        <td>{r.restaurant_name}</td>
                        <td>
                          <span
                            className="restaurant-status-pill"
                            style={{
                              background: RESTAURANT_STATUS_COLORS[status].bg,
                              color: RESTAURANT_STATUS_COLORS[status].color,
                            }}
                          >
                            {status}
                          </span>
                        </td>
                        <td>{new Date(r.created_at).toLocaleDateString("en-GB")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default AdminDashboard;