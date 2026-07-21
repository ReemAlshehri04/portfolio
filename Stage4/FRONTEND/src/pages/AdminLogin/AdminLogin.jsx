import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../../services/auth";
import { useAuth } from "../../context/AuthContext";
import "./AdminLogin.css";
function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
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

      if (data.user.user_type !== "admin") {
        setError("This portal is for authorized administrators only.");
        return;
      }

      login(data.access_token, data.user);
      navigate("/admin/dashboard");
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
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      <div className="al-body">
        <nav className="al-nav">
          <div className="al-nav-inner">
            <Link to="/" className="al-logo">Qooti</Link>
            <div className="al-nav-actions">
              <Link to="/login">Customer Login</Link>
              <Link to="/restaurant-login">Restaurant Login</Link>
            </div>
          </div>
        </nav>

        <main className="al-main">
          <div className="al-blob-1" />
          <div className="al-blob-2" />

          <div className="al-card">
            <div className="al-icon">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            </div>
            <h1 className="al-title">Admin Portal — Qooti</h1>
            <p className="al-subtitle">Welcome back. Please authenticate to access the dashboard.</p>

            <form className="al-form" onSubmit={handleSubmit}>
              <div className="al-field">
                <label className="al-label" htmlFor="email">Email Address</label>
                <input
                  className="al-input"
                  id="email"
                  type="text"
                  name="email"
                  placeholder="admin@qooti_admin.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="al-field">
                <div className="al-label-row">
                  <label className="al-label" htmlFor="password">Password</label>
                  <a href="#" className="al-forgot">Forgot password?</a>
                </div>
                <div className="al-pass-wrap">
                  <input
                    className="al-input"
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    style={{ paddingRight: "48px" }}
                    required
                  />
                  <button
                    type="button"
                    className="al-pass-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="al-remember-row">
                <input type="checkbox" id="remember" />
                <label htmlFor="remember">Remember this session</label>
              </div>

              {error && <p className="al-error">{error}</p>}

              <button className="al-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing In..." : "Login as Admin"}
              </button>
            </form>

            <div className="al-warning">
              <p>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>warning</span>
                This portal is for authorized administrators only.
              </p>
            </div>
          </div>
        </main>

        <footer className="al-footer">
          <div className="al-footer-inner">
            <div>
              <div className="al-footer-logo">Qooti</div>
              <p className="al-footer-desc">© 2026 Qooti. Effortless Health.</p>
            </div>
            <div>
              <div className="al-footer-title">Company</div>
              <div className="al-footer-links">
                <a href="#">About</a>
                <a href="#">Contact</a>
              </div>
            </div>
            <div>
              <div className="al-footer-title">Support</div>
              <div className="al-footer-links">
                <a href="#">FAQ</a>
                <a href="#">Security</a>
              </div>
            </div>
            <div>
              <div className="al-footer-title">Legal</div>
              <div className="al-footer-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Use</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export default AdminLogin;
