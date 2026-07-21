import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authRequest } from "../../services/auth";
import { useAuth } from "../../context/AuthContext";
import "./AdminCustomers.css";

function AdminCustomers() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingRestaurants, setPendingRestaurants] = useState(0);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete customer "${name}"? This cannot be undone.`)) {
      return;
    }
    setDeleteError("");
    setDeletingId(id);
    try {
      await authRequest(`/api/admin/customers/${id}`, "DELETE");
      setCustomers((prev) => prev.filter((c) => c.user_id !== id));
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (user?.user_type !== "admin") return;

    authRequest("/api/admin/customers")
      .then((data) => setCustomers(data.customers || []))
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
            <a href="/admin/customers" className="admin-nav-item active">
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

        <main className="admin-main">
          <div className="admin-header">
            <h1>Customers</h1>
            <p>View all registered customer accounts.</p>
          </div>

          <div className="section-card">
            {deleteError && <div className="table-error">{deleteError}</div>}
            {loading ? (
              <div className="table-empty">Loading...</div>
            ) : error ? (
              <div className="table-error">{error}</div>
            ) : customers.length === 0 ? (
              <div className="table-empty">No customers registered yet.</div>
            ) : (
              <table className="customers-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.user_id}>
                      <td>{c.full_name}</td>
                      <td>{c.email}</td>
                      <td>{c.phone}</td>
                      <td>{new Date(c.created_at).toLocaleDateString("en-GB")}</td>
                      <td>
                        <span className={`status-pill ${c.is_active ? "active" : "inactive"}`}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="delete-btn"
                          disabled={deletingId === c.user_id}
                          onClick={() => handleDelete(c.user_id, c.full_name)}
                        >
                          {deletingId === c.user_id ? "Deleting..." : "Delete"}
                        </button>
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

export default AdminCustomers;
