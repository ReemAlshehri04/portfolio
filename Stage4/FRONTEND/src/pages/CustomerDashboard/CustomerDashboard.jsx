import "./CustomerDashboard.css";
import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar/Navbar";
import { useAuth } from "../../context/AuthContext";
import { authRequest } from "../../services/auth";

const SAMPLE_SCHEDULE = [
  { day: "Sunday", meal: "Miso-Glazed Atlantic Salmon" },
  { day: "Monday", meal: "Golden Harvest Buddha Bowl" },
  { day: "Tuesday", meal: "Grass-Fed Sirloin & Asparagus" },
  { day: "Wednesday", meal: "Provencal Herb Chicken" },
  { day: "Thursday", meal: "Silken Tofu & Avocado" },
];

const STATUS_COLORS = {
  confirmed: { bg: "#e6f4ea", color: "#188038" },
  pending: { bg: "#fff4e5", color: "#b06000" },
  cancelled: { bg: "#fdecea", color: "#b3261e" },
};

function CustomerDashboard() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    const fetchSubscriptions = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await authRequest(`/api/subscriptions/${user.user_id}`);
        setSubscriptions(data.subscriptions || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, [user]);

  const activeSubscription = subscriptions[0];

  return (
    <>
    
      <div className="cd-body">
        <Navbar />

        <main className="cd-main">
          <h1 className="cd-title">My Dashboard</h1>

          {error && <p className="cd-error">{error}</p>}

          {loading ? (
            <p>Loading...</p>
          ) : !activeSubscription ? (
            <div className="cd-empty">
              You don't have an active subscription yet. Head to Meal Plans to get started.
            </div>
          ) : (
            <>
              <div className="cd-card">
                <div className="cd-card-header">
                  <span className="cd-card-title">Active Subscription</span>
                  <span
                    className="cd-status-badge"
                    style={{
                      background: STATUS_COLORS[activeSubscription.status]?.bg || "#f4f4ee",
                      color: STATUS_COLORS[activeSubscription.status]?.color || "#414941",
                    }}
                  >
                    {activeSubscription.status}
                  </span>
                </div>

                <div className="cd-grid">
                  <div>
                    <div className="cd-field-label">Start Date</div>
                    <div className="cd-field-value">{activeSubscription.start_date}</div>
                  </div>
                  <div>
                    <div className="cd-field-label">End Date</div>
                    <div className="cd-field-value">{activeSubscription.end_date}</div>
                  </div>
                  <div>
                    <div className="cd-field-label">Delivery Time</div>
                    <div className="cd-field-value">{activeSubscription.delivery_time}</div>
                  </div>
                  <div>
                    <div className="cd-field-label">Payment Status</div>
                    <div className="cd-field-value" style={{ textTransform: "capitalize" }}>
                      {activeSubscription.payment_status || "—"}
                    </div>
                  </div>
                </div>

                <hr className="cd-divider" />

                <div className="cd-price-row">
                  <span>Original Price</span>
                  <span>SAR {activeSubscription.original_price}</span>
                </div>
                <div className="cd-price-row">
                  <span>Discount</span>
                  <span>− SAR {activeSubscription.discount_amount}</span>
                </div>
                <div className="cd-price-row final">
                  <span>Final Price</span>
                  <span>SAR {activeSubscription.final_price}</span>
                </div>
              </div>

              <div className="cd-card">
                <div className="cd-card-header">
                  <span className="cd-card-title">Weekly Schedule</span>
                </div>

                <table className="cd-schedule-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Meal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_SCHEDULE.map((row) => (
                      <tr key={row.day}>
                        <td>{row.day}</td>
                        <td>{row.meal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p className="cd-sample-note">
                  Sample schedule shown — real meal selections will appear here once available.
                </p>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default CustomerDashboard;
