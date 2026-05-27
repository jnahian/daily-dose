import { Link } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight, Github } from "lucide-react";

export const Hero = () => {
  return (
    <div className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-brand-cyan/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-blue/20 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left Column: Content */}
          <div className="text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-block py-1 px-3 rounded-full bg-brand-blue/10 text-brand-cyan text-sm font-semibold mb-6 border border-brand-blue/20">
                🚀 The Ultimate Standup Bot for Slack
              </span>
              <h1 className="text-5xl sm:text-7xl font-extrabold text-text-primary tracking-tight mb-8 leading-tight">
                Automate your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan to-brand-blue">
                  Daily Standups
                </span>
              </h1>
              <p className="mt-4 text-xl text-text-secondary mb-10 max-w-lg mx-auto lg:mx-0">
                Streamline your team's daily syncs, track progress, and remove
                blockers without the meeting fatigue.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
                <a
                  href="https://github.com/jnahian/daily-dose"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 bg-gradient-to-r from-brand-cyan to-brand-blue rounded-full text-white font-bold text-lg hover:shadow-[0_0_20px_rgba(0,207,255,0.5)] transition-all transform hover:-translate-y-1 flex items-center gap-2 cursor-pointer"
                >
                  <Github size={20} />
                  View on GitHub
                </a>
                <Link
                  to="/docs"
                  className="px-8 py-4 bg-bg-surface border border-border-default rounded-full text-text-primary font-semibold hover:bg-bg-surface/80 transition-all flex items-center gap-2"
                >
                  View Documentation
                  <ArrowRight size={18} />
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Get Started Video */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mx-auto w-full max-w-lg lg:max-w-none"
          >
            <div className="rounded-xl overflow-hidden shadow-2xl border border-border-default ring-1 ring-brand-cyan/20 aspect-video">
              <iframe
                src="https://www.youtube.com/embed/bQrJqBpSlBU?autoplay=1&mute=1&loop=1&playlist=bQrJqBpSlBU&controls=0&modestbranding=1&rel=0"
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="w-full h-full block"
              />
            </div>
            {/* Glow */}
            <div className="absolute -z-10 top-1/2 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-brand-cyan/10 rounded-full blur-[80px]" />
          </motion.div>
        </div>
      </div>
    </div>
  );
};
