import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar/Navbar";
import { useAuth } from "../../context/AuthContext";
import { authRequest } from "../../services/auth";

const STATUS_COLORS = {
  confirmed: { bg: "#e6f4ea", color: "#188038" },
  pending: { bg: "#fff4e5", color: "#b06000" },
  cancelled: { bg: "#fdecea", color: "#b3261e" },
};

function Profile() {
  const { user, updateUser } = useAuth();

  const [form, setForm] = useState({ full_name: "", phone: "", address: "" });
  const [email, setEmail] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const [subscription, setSubscription] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [subError, setSubError] = useState("");

  useEffect(() => {
    authRequest("/api/users/me")
      .then((data) => {
        setForm({
          full_name: data.user.full_name || "",
          phone: data.user.phone || "",
          address: data.user.address || "",
        });
        setEmail(data.user.email || "");
      })
      .catch((err) => setSaveError(err.message))
      .finally(() => setLoadingProfile(false));
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadSubscription = async () => {
      setLoadingSub(true);
      setSubError("");
      try {
        const data = await authRequest(`/api/subscriptions/${user.user_id}`);
        const active = (data.subscriptions || [])[0];
        setSubscription(active || null);

        if (active) {
          const scheduleData = await authRequest(
            `/api/subscriptions/${active.subscription_id}/schedule`
          );
          setSchedule(scheduleData.schedule || []);
        }
      } catch (err) {
        setSubError(err.message);
      } finally {
        setLoadingSub(false);
      }
    };

    loadSubscription();
  }, [user]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage("");
    setSaveError("");
    try {
      const data = await authRequest("/api/users/me", "PUT", form);
      updateUser({ full_name: data.user.full_name, phone: data.user.phone });
      setSaveMessage("Profile updated successfully.");
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{`
        .profile-body { background: #fafaf4; min-height: 100vh; font-family: 'Plus Jakarta Sans', sans-serif; color: #1a1c19; }
        .profile-main { max-width: 700px; margin: 0 auto; padding: 40px 32px 64px; }
        .profile-title { font-family: 'Hanken Grotesk', sans-serif; font-size: 28px; font-weight: 700; margin-bottom: 24px; }
        .profile-card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px rgba(26,28,25,0.04); margin-bottom: 24px; }
        .profile-card-title { font-family: 'Hanken Grotesk', sans-serif; font-size: 18px; font-weight: 700; margin-bottom: 16px; }
        .profile-field { margin-bottom: 16px; }
        .profile-field-label { font-size: 11px; color: #717971; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; display: block; }
        .profile-field-value { font-size: 16px; font-weight: 600; }
        .profile-input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid #dfe3de; font-size: 14px; font-family: inherit; }
        .profile-input:focus { outline: none; border-color: #325f3f; }
        .profile-save-btn { border: none; border-radius: 999px; padding: 10px 22px; background: #325f3f; color: #fff; cursor: pointer; font-size: 14px; font-weight: 600; }
        .profile-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .profile-message { font-size: 13px; color: #188038; margin-top: 10px; }
        .profile-error { font-size: 13px; color: #b3261e; margin-top: 10px; }
        .cd-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .cd-status-badge { font-size: 12px; font-weight: 700; padding: 5px 14px; border-radius: 9999px; text-transform: capitalize; }
        .cd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .cd-field-label { font-size: 11px; color: #717971; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .cd-field-value { font-size: 15px; font-weight: 600; }
        .cd-schedule-table { width: 100%; border-collapse: collapse; }
        .cd-schedule-table th { text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 600; color: #717971; border-bottom: 1px solid #eceee9; }
        .cd-schedule-table td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f4f4ee; }
        .cd-empty { background: #fff; border: 2px dashed #c1c9bf; border-radius: 16px; padding: 40px; text-align: center; color: #717971; }
      `}</style>

      <div className="profile-body">
        <Navbar />

        <main className="profile-main">
          <h1 className="profile-title">My Profile</h1>

          <div className="profile-card">
            <div className="profile-card-title">Account Information</div>

            <div className="profile-field">
              <span className="profile-field-label">Email</span>
              <div className="profile-field-value">{email || "—"}</div>
            </div>

            <form onSubmit={handleSave}>
              <div className="profile-field">
                <label className="profile-field-label" htmlFor="full_name">Full Name</label>
                <input
                  id="full_name"
                  name="full_name"
                  className="profile-input"
                  value={form.full_name}
                  onChange={handleChange}
                  disabled={loadingProfile}
                />
              </div>

              <div className="profile-field">
                <label className="profile-field-label" htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  name="phone"
                  className="profile-input"
                  value={form.phone}
                  onChange={handleChange}
                  disabled={loadingProfile}
                />
              </div>

              <div className="profile-field">
                <label className="profile-field-label" htmlFor="address">Delivery Address</label>
                <input
                  id="address"
                  name="address"
                  className="profile-input"
                  value={form.address}
                  onChange={handleChange}
                  disabled={loadingProfile}
                />
              </div>

              <button className="profile-save-btn" type="submit" disabled={saving || loadingProfile}>
                {saving ? "Saving..." : "Save Changes"}
              </button>

              {saveMessage && <p className="profile-message">{saveMessage}</p>}
              {saveError && <p className="profile-error">{saveError}</p>}
            </form>
          </div>

          <div className="profile-card">
            <div className="profile-card-title">My Subscription</div>

            {subError && <p className="profile-error">{subError}</p>}

            {loadingSub ? (
              <p>Loading...</p>
            ) : !subscription ? (
              <div className="cd-empty">
                You don't have an active subscription yet. Head to Meal Plans to get started.
              </div>
            ) : (
              <>
                <div className="cd-card-header">
                  <span></span>
                  <span
                    className="cd-status-badge"
                    style={{
                      background: STATUS_COLORS[subscription.status]?.bg || "#f4f4ee",
                      color: STATUS_COLORS[subscription.status]?.color || "#414941",
                    }}
                  >
                    {subscription.status}
                  </span>
                </div>

                <div className="cd-grid">
                  <div>
                    <div className="cd-field-label">Start Date</div>
                    <div className="cd-field-value">{subscription.start_date}</div>
                  </div>
                  <div>
                    <div className="cd-field-label">End Date</div>
                    <div className="cd-field-value">{subscription.end_date}</div>
                  </div>
                  <div>
                    <div className="cd-field-label">Delivery Time</div>
                    <div className="cd-field-value">{subscription.delivery_time}</div>
                  </div>
                  <div>
                    <div className="cd-field-label">Final Price</div>
                    <div className="cd-field-value">SAR {subscription.final_price}</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {subscription && schedule.length > 0 && (
            <div className="profile-card">
              <div className="profile-card-title">Weekly Meal Schedule</div>

              <table className="cd-schedule-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Meal</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row) => (
                    <tr key={row.order_item_id}>
                      <td>{row.day_of_week}</td>
                      <td>{row.name}</td>
                      <td style={{ textTransform: "capitalize" }}>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default Profile;
