import "./Profile.css";
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

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address: "",
    age: "",
    gender: "",
    height_cm: "",
    weight_kg: "",
    health_goal: "",
  });
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
          age: data.user.age ?? "",
          gender: data.user.gender || "",
          height_cm: data.user.height_cm ?? "",
          weight_kg: data.user.weight_kg ?? "",
          health_goal: data.user.health_goal || "",
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
            `/api/subscriptions/${active.subscription_id}/schedule`,
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
  const validationErrors = validateProfile();
  if (validationErrors.length > 0) {
    setSaveError(validationErrors.join(" "));
    setSaving(false);
    return;
  }
  try {
    const data = await authRequest("/api/users/me", "PUT", {
      full_name: form.full_name,
      phone: form.phone,
      address: form.address,
      age: form.age === "" ? null : Number(form.age),
      gender: form.gender,
      height_cm: form.height_cm === "" ? null : Number(form.height_cm),
      weight_kg: form.weight_kg === "" ? null : Number(form.weight_kg),
      health_goal: form.health_goal,
    });
    updateUser({ full_name: data.user.full_name, phone: data.user.phone });
    setSaveMessage("Profile updated successfully.");
  } catch (err) {
    setSaveError(err.message);
  } finally {
    setSaving(false);
  }
};
    const validateProfile = () => {
      const errors = [];
      if (
        form.age !== "" &&
        (Number(form.age) < 13 || Number(form.age) > 100)
      ) {
        errors.push("Age must be between 13 and 100.");
      }
      if (
        form.height_cm !== "" &&
        (Number(form.height_cm) < 100 || Number(form.height_cm) > 250)
      ) {
        errors.push("Height must be between 100 and 250 cm.");
      }
      if (
        form.weight_kg !== "" &&
        (Number(form.weight_kg) < 30 || Number(form.weight_kg) > 300)
      ) {
        errors.push("Weight must be between 30 and 300 kg.");
      }
      return errors;
    };
  return (
    <>
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
                <label className="profile-field-label" htmlFor="full_name">
                  Full Name
                </label>
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
                <label className="profile-field-label" htmlFor="phone">
                  Phone
                </label>
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
                <label className="profile-field-label" htmlFor="address">
                  Delivery Address
                </label>
                <input
                  id="address"
                  name="address"
                  className="profile-input"
                  value={form.address}
                  onChange={handleChange}
                  disabled={loadingProfile}
                />
              </div>

              <div className="profile-field">
                <label className="profile-field-label" htmlFor="age">
                  Age
                </label>
                <input
                  id="age"
                  name="age"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="profile-input"
                  value={form.age}
                  onChange={handleChange}
                  disabled={loadingProfile}
                />
              </div>

              <div className="profile-field">
                <label className="profile-field-label" htmlFor="gender">
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  className="profile-input"
                  value={form.gender}
                  onChange={handleChange}
                  disabled={loadingProfile}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="profile-field">
                <label className="profile-field-label" htmlFor="height_cm">
                  Height (cm)
                </label>
                <input
                  id="height_cm"
                  name="height_cm"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  dir="ltr"
                  className="profile-input"
                  value={form.height_cm}
                  onChange={handleChange}
                  disabled={loadingProfile}
                />
              </div>

              <div className="profile-field">
                <label className="profile-field-label" htmlFor="weight_kg">
                  Weight (kg)
                </label>
                <input
                  id="weight_kg"
                  name="weight_kg"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="profile-input"
                  value={form.weight_kg}
                  onChange={handleChange}
                  disabled={loadingProfile}
                />
              </div>

              <div className="profile-field">
                <label className="profile-field-label" htmlFor="health_goal">
                  Health Goal
                </label>
                <select
                  id="health_goal"
                  name="health_goal"
                  className="profile-input"
                  value={form.health_goal}
                  onChange={handleChange}
                  disabled={loadingProfile}
                >
                  <option value="">Select</option>
                  <option value="lose_weight">Lose Weight</option>
                  <option value="maintain">Maintain Healthy Weight</option>
                  <option value="bulking">Bulking</option>
                  <option value="gaining_weight">Gaining Weight</option>
                </select>
              </div>

              <button
                className="profile-save-btn"
                type="submit"
                disabled={saving || loadingProfile}
              >
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
                You don't have an active subscription yet. Head to Meal Plans to
                get started.
              </div>
            ) : (
              <>
                <div className="cd-card-header">
                  <span></span>
                  <span
                    className="cd-status-badge"
                    style={{
                      background:
                        STATUS_COLORS[subscription.status]?.bg || "#f4f4ee",
                      color:
                        STATUS_COLORS[subscription.status]?.color || "#414941",
                    }}
                  >
                    {subscription.status}
                  </span>
                </div>

                <div className="cd-grid">
                  <div>
                    <div className="cd-field-label">Start Date</div>
                    <div className="cd-field-value">
                      {subscription.start_date}
                    </div>
                  </div>
                  <div>
                    <div className="cd-field-label">End Date</div>
                    <div className="cd-field-value">
                      {subscription.end_date}
                    </div>
                  </div>
                  <div>
                    <div className="cd-field-label">Delivery Time</div>
                    <div className="cd-field-value">
                      {subscription.delivery_time}
                    </div>
                  </div>
                  <div>
                    <div className="cd-field-label">Final Price</div>
                    <div className="cd-field-value">
                      SAR {subscription.final_price}
                    </div>
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
                      <td style={{ textTransform: "capitalize" }}>
                        {row.status}
                      </td>
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
