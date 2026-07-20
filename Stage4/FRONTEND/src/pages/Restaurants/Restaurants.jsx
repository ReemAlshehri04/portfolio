import "./Restaurants.css";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet } from "../../services/auth";
import { useAuth } from "../../context/AuthContext";

const SHOWCASE_ICONS = ["eco", "water_drop", "local_dining", "spa"];
const TAG_LABELS = { HighProtein: "High Protein", LowCarb: "Low Carb", GlutenFree: "Gluten Free" };
const labelizeTag = (tag) => TAG_LABELS[tag] || tag;

function Restaurants() {
  const { user, logout } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mealsByRestaurant, setMealsByRestaurant] = useState({});
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    apiGet("/api/restaurants")
      .then((data) => setRestaurants(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    restaurants.forEach((r) => {
      apiGet(`/api/restaurants/${r.restaurant_id}/meals`)
        .then((data) =>
          setMealsByRestaurant((prev) => ({ ...prev, [r.restaurant_id]: data.meals ?? [] }))
        )
        .catch(() => {});
    });
  }, [restaurants]);

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
        {/* Navbar */}
        <nav className="qp-nav">
          <div className="qp-nav-inner">
            <Link to="/" className="qp-logo">Qooti</Link>
            <div className="qp-nav-links">
              {user?.user_type !== "restaurant" && (
                <>
                  <Link to={user ? "/dashboard" : "/restaurants"}>Meal Plans</Link>
                  <Link to="/#how-it-works">How it Works</Link>
                </>
              )}
              <Link to="/restaurants" className="active">Partners</Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {user ? (
                <>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#414941" }}>{user.full_name}</span>
                  <button className="qp-btn-primary" onClick={handleLogout}>Logout</button>
                </>
              ) : (
                <>
                  <Link to="/login"><button className="qp-btn-outline">Log In</button></Link>
                  <Link to="/register"><button className="qp-btn-primary">Sign Up</button></Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Main */}
        <main className="qp-main">
          {loading ? (
            <div className="qp-loading">
              <span className="material-symbols-outlined" style={{ fontSize: "40px", color: "#325f3f", marginRight: "12px" }}>restaurant</span>
              Loading restaurants...
            </div>
          ) : restaurants.length === 0 ? (
            <div className="qp-empty">
              <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "#c1c9bf" }}>storefront</span>
              <p className="qp-empty-title">No restaurants available yet</p>
              <p className="qp-empty-sub">Check back soon — we're adding new partners!</p>
            </div>
          ) : (
            <>
              {/* Hero */}
              <div className="qp-hero">
                <span className="qp-hero-label">Exceptional Standards</span>
                <h1 className="qp-hero-title">Our Culinary Partners</h1>
                <p className="qp-hero-text">
                  We bridge the gap between nutrition science and haute cuisine by partnering with
                  local, health-focused restaurants. Every dish is vetted for nutritional density
                  while maintaining the sophisticated artistry of a professional kitchen.
                </p>
              </div>

              {/* Restaurant showcases */}
              {restaurants.map((r, index) => {
                const meals = mealsByRestaurant[r.restaurant_id] || [];
                const previewDishes = meals.slice(0, 3);
                const tags = [...new Set(meals.flatMap((m) => m.tags || []))].slice(0, 3);
                const icon = SHOWCASE_ICONS[index % SHOWCASE_ICONS.length];

                return (
                  <section
                    key={r.restaurant_id}
                    className={`qp-showcase-section ${index % 2 === 1 ? "alt" : ""}`}
                  >
                    <div className="qp-showcase-inner">
                      <div className={`qp-showcase-row ${index % 2 === 1 ? "reverse" : ""}`}>
                        <div className="qp-showcase-info">
                          <div className="qp-showcase-header">
                            <div className="qp-showcase-icon">
                              <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "#325f3f" }}>{icon}</span>
                            </div>
                            <h2 className="qp-showcase-title">{r.restaurant_name}</h2>
                          </div>

                          <p className="qp-showcase-desc">
                            {r.description || "Healthy meals delivered to your door."}
                          </p>

                          {tags.length > 0 && (
                            <div className="qp-tag-row">
                              {tags.map((tag) => (
                                <span key={tag} className="qp-tag-pill">{labelizeTag(tag)}</span>
                              ))}
                            </div>
                          )}

                          <button
                            className="qp-showcase-cta"
                            onClick={() => navigate(`/restaurants/${r.restaurant_id}/meals`)}
                          >
                            View Full Menu
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>arrow_forward</span>
                          </button>
                        </div>

                        <div className="qp-showcase-image-wrap">
                          {r.logo_url ? (
                            <img src={r.logo_url} alt={r.restaurant_name} className="qp-showcase-image" />
                          ) : (
                            <div className="qp-showcase-image-placeholder">
                              <span className="material-symbols-outlined" style={{ fontSize: "56px", color: "#325f3f" }}>restaurant</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {previewDishes.length > 0 && (
                        <div className="qp-dish-grid">
                          {previewDishes.map((meal) => (
                            <div
                              key={meal.meal_id}
                              className="qp-dish-card"
                              onClick={() => navigate(`/restaurants/${r.restaurant_id}/meals`)}
                              style={{ cursor: "pointer" }}
                            >
                              <div className="qp-dish-img-wrap">
                                {meal.image_url ? (
                                  <img src={meal.image_url} alt={meal.name} className="qp-dish-img" />
                                ) : (
                                  <div className="qp-dish-img-placeholder">
                                    <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "#325f3f" }}>restaurant</span>
                                  </div>
                                )}
                              </div>
                              <div className="qp-dish-body">
                                <h3 className="qp-dish-title">{meal.name}</h3>
                                <div className="qp-dish-stats">
                                  <div className="qp-dish-stat"><b>{meal.calories}</b> kcal</div>
                                  <div className="qp-dish-stat"><b>{meal.protein_g}g</b> protein</div>
                                </div>
                                <p className="qp-dish-desc">{meal.description || meal.ingredients}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}

              {/* Sourcing philosophy banner */}
              <div className="qp-banner-section">
                <div className="qp-banner">
                  <h2 className="qp-banner-title">Our Sourcing Philosophy</h2>
                  <p className="qp-banner-text">
                    We don't just partner with anyone. Every restaurant undergoes a thorough
                    quality review, ensuring they adhere to responsible sourcing, ethical
                    standards, and nutritional transparency.
                  </p>
                  <Link to="/register"><button className="qp-banner-btn">Get Started</button></Link>
                  <span className="material-symbols-outlined qp-banner-icon">nature</span>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Footer */}
        <footer>
          <div className="qp-footer">
            <div className="qp-logo">Qooti</div>
            <div className="qp-footer-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
            <p className="qp-copyright">© 2026 Qooti. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}

export default Restaurants;
