import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authRequest } from "../../services/auth";
import "./AdminPendingRestaurants.css";
function AdminPendingRestaurants() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState("");

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const fetchPending = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authRequest("/api/admin/restaurants/pending");
      setRestaurants(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.user_type === "admin") {
      fetchPending();
    }
  }, [user]);

  const handleApprove = async (id) => {
    setActionError("");
    try {
      await authRequest(`/api/admin/restaurants/${id}/status`, "PATCH", {
        status: "approved",
      });
      setRestaurants((prev) => prev.filter((r) => r.restaurant_id !== id));
    } catch (err) {
      setActionError(err.message);
    }
  };

  const openRejectModal = (id) => {
    setRejectingId(id);
    setRejectionReason("");
    setActionError("");
  };

  const closeRejectModal = () => {
    setRejectingId(null);
    setRejectionReason("");
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) {
      setActionError("Rejection reason is required.");
      return;
    }
    try {
      await authRequest(`/api/admin/restaurants/${rejectingId}/status`, "PATCH", {
        status: "rejected",
        rejection_reason: rejectionReason,
      });
      setRestaurants((prev) => prev.filter((r) => r.restaurant_id !== rejectingId));
      closeRejectModal();
    } catch (err) {
      setActionError(err.message);
    }
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
        <aside className="admin-sidebar">
          <div className="admin-logo">Qooti Admin</div>
          <nav className="admin-nav">
            <a href="/admin/dashboard" className="admin-nav-item">
              <span className="material-symbols-outlined">dashboard</span>
              Overview
            </a>
            <a href="/admin/pending-restaurants" className="admin-nav-item active">
              <span className="material-symbols-outlined">storefront</span>
              Restaurants
              {restaurants.length > 0 && (
                <span className="pending-badge">{restaurants.length}</span>
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

        <main className="admin-main">
          <div className="admin-header">
            <h1>Pending Restaurants</h1>
            <p>Approve or reject new restaurant registrations.</p>
          </div>

          {actionError && <p className="table-error">{actionError}</p>}

          <div className="section-card">
            {loading ? (
              <div className="table-empty">Loading...</div>
            ) : error ? (
              <div className="table-error">{error}</div>
            ) : restaurants.length === 0 ? (
              <div className="table-empty">No restaurants awaiting approval.</div>
            ) : (
              <table className="apr-table">
                <thead>
                  <tr>
                    <th>Restaurant Name</th>
                    <th>Description</th>
                    <th>Registered On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.map((r) => (
                    <tr key={r.restaurant_id}>
                      <td>{r.restaurant_name}</td>
                      <td>{r.description || "—"}</td>
                      <td>{new Date(r.created_at).toLocaleDateString("en-GB")}</td>
                      <td>
                        <button className="apr-btn apr-approve" onClick={() => handleApprove(r.restaurant_id)}>
                          Approve
                        </button>
                        <button className="apr-btn apr-reject" onClick={() => openRejectModal(r.restaurant_id)}>
                          Reject
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

      {rejectingId && (
        <div className="apr-modal-overlay">
          <div className="apr-modal">
            <h3>Reason for rejection</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this restaurant is being rejected..."
            />
            {actionError && <p className="table-error">{actionError}</p>}
            <div className="apr-modal-actions">
              <button className="apr-cancel-btn" onClick={closeRejectModal}>Cancel</button>
              <button className="apr-confirm-btn" onClick={confirmReject}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AdminPendingRestaurants;
