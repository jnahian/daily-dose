import { useEffect } from "react";
import {
  Hero,
  Features,
  HowItWorks,
  Contact,
  Footer,
} from "../components/home";

export const meta = () => {
  return [
    { title: "Daily Dose - Classic Landing Page" },
    { name: "robots", content: "noindex" },
  ];
};

const HomeV1 = () => {
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex";
    document.head.appendChild(tag);
    return () => {
      document.head.removeChild(tag);
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary selection:bg-brand-cyan/30 transition-colors duration-300">
      <Hero />
      <Features />
      <HowItWorks />
      <Contact />
      <Footer />
    </div>
  );
};

export default HomeV1;
