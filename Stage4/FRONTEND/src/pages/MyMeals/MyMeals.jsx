import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authRequest } from "../../services/auth";
import { useAuth } from "../../context/AuthContext";
import QootiLogo from "../../components/QootiLogo/QootiLogo";
import "./MyMeals.css";

function MyMeals() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchMeals = async () => {
      if (!isMounted) return;
      setLoading(true);
      setError("");
      try {
        const { restaurant } = await authRequest("/api/restaurants/me");
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/api/restaurants/${restaurant.restaurant_id}/meals`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to load meals.");
        if (isMounted) setMeals(data.meals || []);
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMeals();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDelete = async (mealId) => {
    if (!window.confirm("Delete this meal?")) return;
    try {
      await authRequest(`/api/meals/${mealId}`, "DELETE");
      setMeals((prev) => prev.filter((m) => m.meal_id !== mealId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (meal) => {
    navigate(`/restaurant/meals/${meal.meal_id}/edit`, { state: { meal } });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const totalMeals = meals.length;
  const avgCalories = totalMeals ? Math.round(meals.reduce((sum, m) => sum + m.calories, 0) / totalMeals) : 0;
  const avgProtein = totalMeals ? Math.round(meals.reduce((sum, m) => sum + Number(m.protein_g), 0) / totalMeals) : 0;
  const uniqueTags = new Set(meals.flatMap((m) => m.tags || [])).size;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      <div className="mm-body">
        <aside className="mm-sidebar">
          <div className="mm-logo">
            <QootiLogo scale={0.55} />
            <small>Partner Portal</small>
          </div>
          <nav className="mm-nav">
            <Link to="/restaurant/meals" className="mm-nav-item active">
              <span className="material-symbols-outlined">restaurant_menu</span>
              My Meals
            </Link>
            <Link to="/restaurant/orders" className="mm-nav-item">
              <span className="material-symbols-outlined">receipt_long</span>
              Orders
            </Link>
          </nav>
          <Link to="/restaurant/meals/new" className="mm-add-sidebar-btn">+ Add New Meal</Link>
          <div className="mm-sidebar-footer">
            <button className="mm-logout-btn" onClick={handleLogout}>Log Out</button>
          </div>
        </aside>

        <main className="mm-main">
          <div className="mm-header">
            <div>
              <h1 className="mm-title">My Meals</h1>
              <p className="mm-subtitle">Manage your restaurant's menu and track nutritional data at a glance.</p>
            </div>
            {user && <span className="mm-user">{user.full_name}</span>}
          </div>

          {error && <p className="mm-error">{error}</p>}

          {!loading && meals.length > 0 && (
            <div className="mm-stats-grid">
              <div className="mm-stat-card">
                <div className="mm-stat-value">{totalMeals}</div>
                <div className="mm-stat-label">Total Meals</div>
              </div>
              <div className="mm-stat-card">
                <div className="mm-stat-value">{avgCalories}</div>
                <div className="mm-stat-label">Avg. Calories</div>
              </div>
              <div className="mm-stat-card">
                <div className="mm-stat-value">{avgProtein}g</div>
                <div className="mm-stat-label">Avg. Protein</div>
              </div>
              <div className="mm-stat-card">
                <div className="mm-stat-value">{uniqueTags}</div>
                <div className="mm-stat-label">Menu Tags</div>
              </div>
            </div>
          )}

          {loading ? (
            <p>Loading...</p>
          ) : meals.length === 0 ? (
            <div className="mm-empty">No meals yet. Click "Add New Meal" to create your first one.</div>
          ) : (
            <table className="mm-table">
              <thead>
                <tr>
                  <th>Meal</th>
                  <th>Calories</th>
                  <th>Macros (P/C/F)</th>
                  <th>Tags</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {meals.map((meal) => (
                  <tr key={meal.meal_id}>
                    <td>
                      <div className="mm-meal-name">{meal.name}</div>
                      <div className="mm-meal-desc">{meal.description}</div>
                    </td>
                    <td>{meal.calories} kcal</td>
                    <td className="mm-macros">P:{meal.protein_g}g &nbsp; C:{meal.carbs_g}g &nbsp; F:{meal.fats_g}g</td>
                    <td>
                      <div className="mm-tags">
                        {(meal.tags || []).map((tag) => (
                          <span key={tag} className="mm-tag">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button className="mm-btn mm-edit-btn" onClick={() => handleEdit(meal)}>Edit</button>
                      <button className="mm-btn mm-delete-btn" onClick={() => handleDelete(meal.meal_id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      </div>
    </>
  );
}

export default MyMeals;
