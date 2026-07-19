import "./Register.css";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../../services/auth";
function Register() {
  const navigate = useNavigate();
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    age: "",
    gender: "",
    height: "",
    weight: "",
    healthGoal: "",
    address: "",
    password: "",
    confirmPassword: "",
  });
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const firstErrorEl = document.querySelector(".qp-error");
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [errors]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (errors[name]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };
  const validate = () => {
    const errors = {};
    if (formData.fullName.trim().length < 2) {
      errors.fullName = "Please enter your full name.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address.";
    }
    if (!/^0[0-9]{8,14}$/.test(formData.phone.replace(/\s/g, ""))) {
      errors.phone = "Phone number must contain digits only and start with 0.";
    }
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(
        formData.password,
      )
    ) {
      errors.password =
        "Must be 8+ characters with uppercase, lowercase, a number, and a special character.";
    }
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }
    const age = Number(formData.age);
    if (!age || age < 13 || age > 100) {
      errors.age = "Age must be between 13 and 100.";
    }
    const height = Number(formData.height);
    if (!height || height < 100 || height > 250) {
      errors.height = "Height must be between 100 and 250 cm.";
    }
    const weight = Number(formData.weight);
    if (!weight || weight < 30 || weight > 300) {
      errors.weight = "Weight must be between 30 and 300 kg.";
    }
    if (!formData.address.trim()) {
      errors.address = "Please enter a delivery address.";
    }
    return errors;
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsSubmitting(true);
    try {
      await registerUser({
        user_type: "client",
        full_name: formData.fullName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        age: Number(formData.age),
        gender: formData.gender,
        height_cm: Number(formData.height),
        weight_kg: Number(formData.weight),
        health_goal: formData.healthGoal,
        address: formData.address,
      });
      navigate("/login");
    } catch (err) {
      setErrors({ general: err.message });
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
      <div className="qp-body">
        <main className="qp-main">
          <div className="qp-grid">
            <div className="qp-hero">
              <div></div>
              <div className="qp-img-wrap"></div>
            </div>

            <div className="qp-card">
              <h2 className="qp-card-title">Create Account</h2>
              <p className="qp-card-sub">
                Enter your details to begin your transformation.
              </p>

              <form className="qp-form" onSubmit={handleSubmit}>
                <div className="qp-field">
                  <label className="qp-label">Full Name</label>
                  <input
                    className="qp-input"
                    type="text"
                    name="fullName"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={handleChange}
                  />
                  {errors.fullName && (
                    <p className="qp-error">{errors.fullName}</p>
                  )}
                </div>

                <div className="qp-field">
                  <label className="qp-label">Email Address</label>
                  <input
                    className="qp-input"
                    type="email"
                    name="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                  {errors.email && <p className="qp-error">{errors.email}</p>}
                </div>

                <div className="qp-field">
                  <label className="qp-label">Phone Number</label>
                  <input
                    className="qp-input"
                    type="tel"
                    name="phone"
                    placeholder="05xxxxxxxx"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                  {errors.phone && <p className="qp-error">{errors.phone}</p>}
                </div>

                <div className="qp-field">
                  <label className="qp-label">Password</label>
                  <input
                    className="qp-input"
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  {errors.password && (
                    <p className="qp-error">{errors.password}</p>
                  )}
                </div>

                <div className="qp-field">
                  <label className="qp-label">Confirm Password</label>
                  <input
                    className="qp-input"
                    type="password"
                    name="confirmPassword"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                  {errors.confirmPassword && (
                    <p className="qp-error">{errors.confirmPassword}</p>
                  )}
                </div>

                <div className="qp-grid2">
                  <div className="qp-field">
                    <label className="qp-label">Age</label>
                    <input
                      className="qp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      name="age"
                      placeholder="25"
                      value={formData.age}
                      onChange={handleChange}
                    />
                    {errors.age && <p className="qp-error">{errors.age}</p>}
                  </div>
                  <div className="qp-field">
                    <label className="qp-label">Gender</label>
                    <select
                      className="qp-select"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    {errors.gender && (
                      <p className="qp-error">{errors.gender}</p>
                    )}
                  </div>
                </div>

                <div className="qp-grid2">
                  <div className="qp-field">
                    <label className="qp-label">Height (cm)</label>
                    <input
                      className="qp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      name="height"
                      placeholder="170"
                      value={formData.height}
                      onChange={handleChange}
                    />
                    {errors.height && (
                      <p className="qp-error">{errors.height}</p>
                    )}
                  </div>
                  <div className="qp-field">
                    <label className="qp-label">Weight (kg)</label>
                    <input
                      className="qp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      name="weight"
                      placeholder="65"
                      value={formData.weight}
                      onChange={handleChange}
                    />
                    {errors.weight && (
                      <p className="qp-error">{errors.weight}</p>
                    )}
                  </div>
                </div>

                <div className="qp-field">
                  <label className="qp-label">Health Goal</label>
                  <select
                    className="qp-select"
                    name="healthGoal"
                    value={formData.healthGoal}
                    onChange={handleChange}
                  >
                    <option value="">Choose your primary focus</option>
                    <option value="lose_weight">Lose Weight</option>
                    <option value="maintain">Maintain Healthy Weight</option>
                    <option value="bulking">Bulking</option>
                    <option value="gaining_weight">Gaining Weight</option>
                  </select>
                  {errors.healthGoal && (
                    <p className="qp-error">{errors.healthGoal}</p>
                  )}
                </div>

                <div className="qp-field">
                  <label className="qp-label">Delivery Address</label>
                  <input
                    className="qp-input"
                    type="text"
                    name="address"
                    placeholder="123 Main St, Riyadh"
                    value={formData.address}
                    onChange={handleChange}
                  />
                  {errors.address && (
                    <p className="qp-error">{errors.address}</p>
                  )}
                </div>

                {errors.general && <p className="qp-error">{errors.general}</p>}

                <button
                  className="qp-submit"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating Account..." : "Create Account"}
                  <span className="material-symbols-outlined">
                    arrow_forward
                  </span>
                </button>
              </form>

              <p className="qp-footer-link">
                Already have an account? <Link to="/login">Log In</Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
export default Register;
