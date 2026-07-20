import "./MealBrowse.css";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";

function MealBrowse() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMeals = async () => {
      setLoading(true);
      setError("");
      try {
        const base =
          import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
        const res = await fetch(
          `${base}/api/restaurants/${restaurantId}/meals`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to load meals.");
        setMeals(data.meals || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMeals();
  }, [restaurantId]);

  return (
    <>
      <div className="mb-body">
        <Navbar />

        <main className="mb-main">
          <div className="mb-header-row">
            <h1 className="mb-title">Menu</h1>
            <button
              className="mb-cta-btn"
              onClick={() =>
                navigate(`/weekly-selection?restaurant=${restaurantId}`)
              }
            >
              Start Weekly Plan →
            </button>
          </div>

          {error && <p className="mb-error">{error}</p>}

          {loading ? (
            <p>Loading...</p>
          ) : meals.length === 0 ? (
            <div className="mb-empty">
              No meals available from this restaurant yet.
            </div>
          ) : (
            <div className="mb-grid">
              {meals.map((meal) => (
                <div className="mb-card" key={meal.meal_id}>
                  <div className="mb-image">
                    {meal.image_url ? (
                      <img src={meal.image_url} alt={meal.name} />
                    ) : (
                      "🍽️"
                    )}
                  </div>
                  <div className="mb-content">
                    <div className="mb-tags">
                      {(meal.tags || []).map((tag) => (
                        <span key={tag} className="mb-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mb-name">{meal.name}</div>
                    <p className="mb-description">{meal.description}</p>
                    <div className="mb-stats">
                      <span>{meal.calories} kcal</span>
                      <span>{meal.protein_g}g protein</span>
                      <span>{meal.carbs_g}g carbs</span>
                      <span>{meal.fats_g}g fat</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default MealBrowse;
