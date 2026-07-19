import "./Login.css";
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { loginUser, roleHome } from "../../services/auth";
import { useAuth } from "../../context/AuthContext";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const errors = [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push("Please enter a valid email address.");
    }
    if (formData.password.length < 8) {
      errors.push("Password must be at least 8 characters.");
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError.length > 0) {
      setError(validationError.join(" "));
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await loginUser(formData);
      login(data.access_token, data.user);

      const redirectTo = location.state?.redirectTo;
      if (redirectTo) {
        navigate(redirectTo, { state: location.state.redirectState });
      } else {
        navigate(roleHome(data.user.user_type));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <div className="login-body">
        <main className="login-main">
          <section className="login-right">
            <div className="login-right-inner">
              <h2 className="login-title">Welcome back</h2>
              <p className="login-subtitle">
                Sign in to your account to continue your wellness journey.
              </p>
              <form className="login-form" onSubmit={handleSubmit}>
                <div className="login-field">
                  <label className="login-label">Email Address</label>
                  <input
                    className="login-input"
                    type="text"
                    name="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="login-field">
                  <div className="login-label-row">
                    <label className="login-label">Password</label>
                    <a href="#" className="login-forgot">
                      Forgot Password?
                    </a>
                  </div>
                  <div className="login-pass-wrap">
                    <input
                      className="login-input"
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
                      className="login-pass-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  <p className="login-hint">Must be at least 8 characters.</p>
                </div>
                {error && <p className="login-error">{error}</p>}
                <button
                  className="login-submit"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Signing In..." : "Sign In"}
                </button>
              </form>
              <p className="login-footer-link">
                Don't have an account?
                <Link to="/register">Sign Up</Link>
              </p>
              <div className="login-role-row">
                <Link to="/restaurant-login" className="login-role-btn">
                  <span className="material-symbols-outlined">storefront</span>
                  Restaurant Login
                </Link>
                <Link to="/admin/login" className="login-role-btn">
                  <span className="material-symbols-outlined">
                    admin_panel_settings
                  </span>
                  Admin Login
                </Link>
              </div>

              <div className="login-brand-footer">
                <p>© 2026 Qooti. Effortless Health.</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

export default Login;
