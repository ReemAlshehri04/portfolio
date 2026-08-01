import "./Landing.css";
import heroImage from "../../assets/landingpage.jpg";
import {Link} from "react-router-dom";
import QootiLogo from "../../components/QootiLogo/QootiLogo";
function Landing() {
  return (
    <>
      <nav className="ld-nav">
        <div className="ld-nav-inner">
          <a href="#top" className="ld-logo">
            <QootiLogo scale={0.8} />
          </a>
          <ul className="ld-nav-links">
            <li>
              <a href="#features">Features</a>
            </li>
            <li>
              <a href="#about">About</a>
            </li>
            <li>
              <a href="#team">Team</a>
            </li>
          </ul>
          <Link
            className="ld-btn-primary"
            to="/home"
            onClick={() => localStorage.setItem("landingSeen", "true")}
          >
            Open Qooti →
          </Link>
        </div>
      </nav>
      <header
        className="ld-hero"
        id="top"
        style={{backgroundImage: `url(${heroImage})`}}
      >
        <div className="ld-hero-overlay" />
        <div className="ld-hero-content">
          <h1>
            Effortless Health,
            <br />
            <span>Delivered to Your Door</span>
          </h1>
          <p className="ld-lede">
            Most healthy meal subscriptions lock you into one restaurant for the
            whole month. Qooti doesn't — pick Sunday's bowl from one kitchen and
            Wednesday's plate from another, all under a single weekly plan, one
            delivery address, one checkout.
          </p>
        </div>
      </header>
      <section id="features">
        <div className="ld-wrap">
          <h2 className="ld-section-title">Three Things Qooti Gets Right</h2>
          <div className="ld-title-line"></div>
          <div className="ld-features-grid">
            <div className="ld-feature-card">
              <div className="ld-feature-visual">
                <img src="weekly-selection.png" alt="Weekly selection screen" />
              </div>
              <h3>One Cart, Every Kitchen</h3>
              <p>
                Browse meals from different restaurants in one place and choose
                your meals for each day with one easy checkout.
              </p>
            </div>
            <div className="ld-feature-card">
              <div className="ld-feature-visual">
                <img src="mealcards.png" alt="Meal cards" />
              </div>
              <h3>Know What You Eat</h3>
              <p>
                Every meal shows calories, protein, carbs and fat before you
                choose it — building a week that fits your goals doesn't need a
                spreadsheet on the side.
              </p>
            </div>

            <div className="ld-feature-card">
              <div className="ld-feature-visual">
                <img
                  src="OrderSummaryandCheckout.png"
                  alt="Order summary and checkout"
                />
              </div>
              <h3>One Flat Weekly Price</h3>
              <p>
                Five meals, one price, one delivery window. Apply a discount
                code, pick a delivery slot, and pay once — the whole week is
                already planned.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="ld-about" id="about">
        <div className="ld-wrap">
          <h2 className="ld-section-title">Our Story and Why We Built Qooti</h2>

          <div className="ld-about-card">
            <p>
              Most healthy-meal subscriptions ask for a full month with one
              kitchen. Skip a day you don't like the menu and you've paid for it
              anyway — which is exactly where people quietly fall off the plan.
              For anyone juggling work or school, the alternative isn't better:
              ordering from a different restaurant every day means re-entering
              your address, re-checking out, and coordinating a new courier each
              time.
            </p>

            <p>
              Qooti removes the trade-off. Subscribe once, then build your week
              across every approved kitchen — a bowl from one restaurant on
              Sunday, a stir-fry from another on Wednesday — under one plan, one
              address, one flat price.
            </p>

            <div className="ld-holberton-line">
              Qooti is a portfolio project built for{" "}
              <a
                href="https://hbtn.dev/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Holberton School.
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="ld-team-section" id="team">
        <div className="ld-wrap">
          <h2 className="ld-section-title">Meet the Team</h2>

          <ul className="ld-team-list">
            <li className="ld-team-member">
              <p className="ld-team-name">Reem Alshehri</p>
              <div className="ld-team-social">
                <a
                  href="https://www.linkedin.com/in/reem-alshehri-79383233b"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
                <a
                  href="https://github.com/ReemAlshehri04"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </div>
            </li>

            <li className="ld-team-member">
              <p className="ld-team-name">Badriah AlMalki</p>
              <div className="ld-team-social">
                <a
                  href="https://www.linkedin.com/in/badriah-b-almalki/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
                <a
                  href="https://github.com/badriahalmalki"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </div>
            </li>

            <li className="ld-team-member">
              <p className="ld-team-name">Yara Ibrahim</p>
              <div className="ld-team-social">
                <a
                  href="https://www.linkedin.com/in/yara-ibrahim-985377380"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
                <a
                  href="https://github.com/yaraibrahim"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </div>
            </li>

            <li className="ld-team-member">
              <p className="ld-team-name">Moudhi Almutlaq</p>
              <div className="ld-team-social">
                <a
                  href="https://www.linkedin.com/in/moudhi-almutlaq"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
                <a
                  href="https://github.com/Modi-01"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </div>
            </li>
          </ul>

          <h3 className="ld-side-title">Source</h3>

          <a
            className="ld-repo-link"
            href="https://github.com/ReemAlshehri04/portfolio"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>github.com/ReemAlshehri04/portfolio</span>
            <span>↗</span>
          </a>
        </div>
      </section>
      <footer className="ld-footer">
        <div className="ld-wrap">
          <a href="#top" className="ld-logo">
            <QootiLogo scale={0.8} />
          </a>
          <ul className="ld-foot-links">
            <li>
              <a href="#about">About</a>
            </li>
          </ul>
          <p className="ld-copyright">
            © 2026 Qooti — Holberton School portfolio project.
          </p>
        </div>
      </footer>
    </>
  );
}
export default Landing;
