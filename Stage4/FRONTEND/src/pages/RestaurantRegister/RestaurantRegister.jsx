import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../../services/auth";
import QootiLogo from "../../components/QootiLogo/QootiLogo";
import "./RestaurantRegister.css";

function RestaurantRegister() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    restaurantName: "",
    ownerFullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    description: "",
    agreed: false,
  });
  const [logoFile, setLogoFile] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const handleLogoChange = (e) => {
    setLogoFile(e.target.files?.[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^[a-zA-Z0-9._%+-]+@restaurant\.com$/i.test(formData.email.trim())) {
      setError("Please use a restaurant.com email address to register as a restaurant.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!formData.agreed) {
      setError("You must agree to the Partner Agreement and Privacy Policy.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerUser({
        user_type: "restaurant",
        full_name: formData.ownerFullName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        restaurant_name: formData.restaurantName,
        description: formData.description,
      });
      navigate("/login");
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

      <div className="pr-body">
        <main className="pr-main">
          <section className="pr-left">
            <div className="pr-logo-top"><QootiLogo scale={0.75} /></div>
            <h1 className="pr-left-title">Join our network of healthy restaurants</h1>
            <p className="pr-left-desc">
              Partner with Qooti to reach thousands of health-conscious
              professionals seeking premium, nutritious meals delivered with care.
            </p>
            <div className="pr-stats">
              <div>
                <div className="pr-stat-num">500+</div>
                <div className="pr-stat-label">Active Partners</div>
              </div>
              <div>
                <div className="pr-stat-num">15k+</div>
                <div className="pr-stat-label">Monthly Users</div>
              </div>
            </div>
          </section>

          <section className="pr-right">
            <div className="pr-card">
              <h2 className="pr-card-title">Partner Registration</h2>
              <p className="pr-card-sub">Fill in your details to start your journey with us.</p>

              <form className="pr-form" onSubmit={handleSubmit}>
                <div className="pr-grid2">
                  <div className="pr-field">
                    <label className="pr-label">Restaurant Name</label>
                    <input className="pr-input" type="text" name="restaurantName" placeholder="e.g. Green Leaf Cafe" value={formData.restaurantName} onChange={handleChange} required />
                  </div>
                  <div className="pr-field">
                    <label className="pr-label">Owner Full Name</label>
                    <input className="pr-input" type="text" name="ownerFullName" placeholder="Sarah Mohammed" value={formData.ownerFullName} onChange={handleChange} required />
                  </div>
                </div>

                <div className="pr-grid2">
                  <div className="pr-field">
                    <label className="pr-label">Email</label>
                    <input className="pr-input" type="email" name="email" placeholder="owner@restaurant.com" value={formData.email} onChange={handleChange} required />
                  </div>
                  <div className="pr-field">
                    <label className="pr-label">Phone Number</label>
                    <input className="pr-input" type="tel" name="phone" placeholder="+966 54321 0987" value={formData.phone} onChange={handleChange} required />
                  </div>
                </div>

                <div className="pr-grid2">
                  <div className="pr-field">
                    <label className="pr-label">Password</label>
                    <input className="pr-input" type="password" name="password" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
                  </div>
                  <div className="pr-field">
                    <label className="pr-label">Confirm Password</label>
                    <input className="pr-input" type="password" name="confirmPassword" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} required />
                  </div>
                </div>

                <div className="pr-field">
                  <label className="pr-label">Restaurant Description</label>
                  <textarea className="pr-textarea" name="description" placeholder="Tell us about your culinary philosophy and specialties..." value={formData.description} onChange={handleChange} />
                </div>

                <div className="pr-field">
                  <label className="pr-label">Logo Upload</label>
                  <label className="pr-dropzone">
                    {logoFile ? logoFile.name : "Drag and drop or click to browse — PNG, JPG up to 5MB"}
                    <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} hidden />
                  </label>
                </div>

                <label className="pr-checkbox-row">
                  <input type="checkbox" name="agreed" checked={formData.agreed} onChange={handleChange} />
                  I agree to the Partner Agreement and Privacy Policy.
                </label>

                {error && <p className="pr-error">{error}</p>}

                <button className="pr-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Registering..." : "Register as Partner"}
                </button>
              </form>

              <p className="pr-footer-link">
                Already have an account? <Link to="/login">Login</Link>
              </p>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

export default RestaurantRegister;