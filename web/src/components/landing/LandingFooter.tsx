import { Link } from "react-router";
import { Github } from "lucide-react";

const links = [
  { label: "Documentation", to: "/docs" },
  { label: "Changelog", to: "/changelog" },
  { label: "Contact", to: "/contact" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
];

export const LandingFooter = () => (
  <footer className="border-t border-slate-800 px-4 py-12 sm:px-6 lg:px-8">
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="" className="h-7 w-7 rounded-md" />
        <span className="font-bold text-slate-50">Daily Dose</span>
      </div>
      <nav
        aria-label="Footer"
        className="flex flex-wrap justify-center gap-x-6 gap-y-2"
      >
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="text-[14px] text-slate-400 transition-colors hover:text-slate-50"
          >
            {l.label}
          </Link>
        ))}
        <a
          href="https://github.com/jnahian/daily-dose"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository"
          className="text-slate-400 transition-colors hover:text-slate-50"
        >
          <Github size={18} />
        </a>
      </nav>
      <p className="text-[13px] text-slate-500">
        © 2026 Daily Dose · MIT License
      </p>
    </div>
  </footer>
);
