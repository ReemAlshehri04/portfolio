import { useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { authRequest } from "../../services/auth";
import "./EditMeal.css";

function EditMeal() {
  const navigate = useNavigate();
  const { mealId } = useParams();
  const location = useLocation();
  const meal = location.state?.meal;

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: meal?.name || "",
    description: meal?.description || "",
    ingredients: meal?.ingredients || "",
    calories: meal?.calories ?? "",
    protein_g: meal?.protein_g ?? "",
    carbs_g: meal?.carbs_g ?? "",
    fats_g: meal?.fats_g ?? "",
    image_url: meal?.image_url || "",
    tags: (meal?.tags || []).join(", "),
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await authRequest(`/api/meals/${mealId}`, "PUT", {
        name: formData.name,
        description: formData.description,
        ingredients: formData.ingredients,
        calories: Number(formData.calories),
        protein_g: Number(formData.protein_g),
        carbs_g: Number(formData.carbs_g),
        fats_g: Number(formData.fats_g),
        image_url: formData.image_url,
        tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      navigate("/restaurant/meals");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!meal) {
    return (
      <div style={{ padding: 48, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <p>No meal data found. Please go back and click Edit from the My Meals table.</p>
        <Link to="/restaurant/meals">Back to My Meals</Link>
      </div>
    );
  }

  return (
    <>
      <div className="am-body">
        <div className="am-card">
          <h1 className="am-title">Edit Meal</h1>

          <form onSubmit={handleSubmit}>
            <div className="am-field">
              <label className="am-label">Name</label>
              <input className="am-input" name="name" value={formData.name} onChange={handleChange} required />
            </div>

            <div className="am-field">
              <label className="am-label">Description</label>
              <textarea className="am-textarea" name="description" value={formData.description} onChange={handleChange} required />
            </div>

            <div className="am-field">
              <label className="am-label">Ingredients</label>
              <textarea className="am-textarea" name="ingredients" value={formData.ingredients} onChange={handleChange} required />
            </div>

            <div className="am-field">
              <label className="am-label">Image URL</label>
              <input className="am-input" name="image_url" value={formData.image_url} onChange={handleChange} required />
            </div>

            <div className="am-field">
              <label className="am-label">Category / Tags (comma separated)</label>
              <input className="am-input" name="tags" value={formData.tags} onChange={handleChange} required />
            </div>

            <div className="am-field">
              <label className="am-label">Nutrition (per serving)</label>
              <div className="am-row3">
                <input className="am-input" type="text" inputMode="numeric" pattern="[0-9]*" name="calories" placeholder="Calories" value={formData.calories} onChange={handleChange} required />
                <input className="am-input" type="text" inputMode="numeric" pattern="[0-9]*" name="protein_g" placeholder="Protein (g)" value={formData.protein_g} onChange={handleChange} required />
                <input className="am-input" type="text" inputMode="numeric" pattern="[0-9]*" name="carbs_g" placeholder="Carbs (g)" value={formData.carbs_g} onChange={handleChange} required />
              </div>
              <input className="am-input" type="text" inputMode="numeric" pattern="[0-9]*" name="fats_g" placeholder="Fats (g)" value={formData.fats_g} onChange={handleChange} required style={{ marginTop: "10px" }} />
            </div>

            {error && <p className="am-error">{error}</p>}

            <div className="am-actions">
              <Link to="/restaurant/meals" className="am-cancel-link">Cancel</Link>
              <button className="am-submit-btn" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default EditMeal;
