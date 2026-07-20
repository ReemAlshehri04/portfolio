import { useEffect } from "react";
import "./Home.css";
import Navbar from "../../components/Navbar/Navbar";
import Hero from "../../components/Hero/Hero";
import HowItWorks from "../../components/HowItWorks/HowItWorks";
import Benefits from "../../components/Benefits/Benefits";
import FAQ from "../../components/FAQ/FAQ";
import Footer from "../../components/Footer/Footer";

function Home() {
  useEffect(() => {
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
  }, []);

  return (
    <>
     <Navbar transparent />
      <Hero />
      <HowItWorks />
      <Benefits />
      <FAQ />
      <Footer />
    </>
  );
}

export default Home;
