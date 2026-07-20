import { useNavigate } from "react-router-dom";
import "./Hero.css";
import heroImage from "../../assets/hero.png";

function Hero() {
  const navigate = useNavigate();

  return (
    <section
      className="hero"
      style={{ backgroundImage: `url(${heroImage})` }}
    >
      <div className="hero-overlay" />

      <div className="hero-content">

        <h1>
          Effortless Health
          <br />
          Delivered to Your Door
        </h1>

        <p>
          Premium, chef-prepared meals tailored to your biometric needs.
          Skip the prep, ignore the dishes, and focus on what matters most.
        </p>

        <div className="hero-buttons">
          <button className="primary-btn" onClick={() => navigate("/restaurants")}>
            Subscribe Now
          </button>

        </div>
      </div>
    </section>
  );
}

export default Hero;