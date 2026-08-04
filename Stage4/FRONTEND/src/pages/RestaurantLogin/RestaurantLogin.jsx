import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, roleHome } from "../../services/auth";
import { useAuth } from "../../context/AuthContext";
import qootiLogo from "../../assets/qooti-logo.svg";
import "./RestaurantLogin.css";

function RestaurantLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const data = await loginUser(formData);
      login(data.access_token, data.user);
      navigate(roleHome(data.user.user_type));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <div className="rl-body">
        <main className="rl-main">
          <section className="rl-left">
            <div className="rl-logo-top"><img src={qootiLogo} alt="Qooti" style={{ width: 120, height: 120 }} /></div>
            <h1 className="rl-left-title">Welcome back, partner.</h1>
            <p className="rl-left-desc">
              Sign in to manage your menu, track orders, and grow with
              thousands of health-conscious customers.
            </p>
            <div className="rl-stats">
              <div>
                <div className="rl-stat-num">500+</div>
                <div className="rl-stat-label">Active Partners</div>
              </div>
              <div>
                <div className="rl-stat-num">15k+</div>
                <div className="rl-stat-label">Monthly Users</div>
              </div>
            </div>
          </section>

          <section className="rl-right">
            <div className="rl-card">
              <h2 className="rl-card-title">Partner Login</h2>
              <p className="rl-card-sub">Sign in to your restaurant account.</p>

              <form className="rl-form" onSubmit={handleSubmit}>
                <div className="rl-field">
                  <label className="rl-label">Email</label>
                  <input className="rl-input" type="email" name="email" placeholder="owner@restaurant.com" value={formData.email} onChange={handleChange} required />
                </div>

                <div className="rl-field">
                  <label className="rl-label">Password</label>
                  <input className="rl-input" type="password" name="password" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
                </div>

                {error && <p className="rl-error">{error}</p>}

                <button className="rl-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing In..." : "Sign In"}
                </button>
              </form>

              <p className="rl-footer-link">
                Don't have a restaurant account? <Link to="/restaurant-register">Register</Link>
              </p>

              <p className="rl-footer-link">
                Are you a customer? <Link to="/login">Login here</Link>
              </p>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

export default RestaurantLogin;