import { Link } from "react-router";
import { ArrowRight, Github } from "lucide-react";

export const CtaButtons = () => (
  <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
    <a
      href="https://github.com/jnahian/daily-dose"
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-6 py-3 text-[15px] font-semibold text-[#0A0E16] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan"
    >
      <Github size={18} />
      View on GitHub
    </a>
    <Link
      to="/docs"
      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-slate-800 px-6 py-3 text-[15px] font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan"
    >
      Documentation
      <ArrowRight size={16} />
    </Link>
  </div>
);
